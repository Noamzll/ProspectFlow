/* ProspectFlow : Google Sheet -> Supabase uniquement.
 * Les secrets se configurent dans Paramètres du projet > Propriétés du script.
 * Ne pas les écrire ici. La clé Supabase reste exclusivement dans Netlify.
 */
const PF_BATCH_SIZE = 200;
const PF_MAX_ROWS = 5000;
const PF_HEADERS = ['Entreprise', 'Secteur', 'Ville', 'Email', 'Site internet', 'Statut', 'Prochaine action', 'Prospect ID'];
const PF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function syncNow() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { skipped: true };
  try {
    const properties = PropertiesService.getScriptProperties();
    const config = pfConfig_(properties);
    const sheet = SpreadsheetApp.openById(config.spreadsheetId).getSheets()
      .find(function (item) { return String(item.getSheetId()) === config.sheetId; });
    if (!sheet) throw new Error('Onglet configuré introuvable.');
    if (sheet.getLastRow() > PF_MAX_ROWS + 1) throw new Error('Maximum 5 000 lignes par onglet synchronisé.');
    const values = sheet.getDataRange().getDisplayValues();
    const prepared = pfPrepareRows_(values);
    if (!prepared.rows.length) {
      console.log('ProspectFlow : aucune ligne à synchroniser ; aucune suppression.');
      return { created: 0, updated: 0, unchanged: 0, dryRun: config.dryRun };
    }
    if (prepared.idsChanged) {
      // Détecter un déplacement ou une édition pendant la première attribution des IDs.
      if (JSON.stringify(sheet.getDataRange().getDisplayValues()) !== JSON.stringify(values)) {
        throw new Error('Le Sheet a changé pendant la lecture. Relancez syncNow().');
      }
      // Une seule écriture de colonne, avant tout envoi. Les IDs existants sont conservés.
      sheet.getRange(2, prepared.idColumn + 1, prepared.ids.length, 1).setValues(prepared.ids);
      SpreadsheetApp.flush();
    }
    const batches = [];
    for (let offset = 0; offset < prepared.rows.length; offset += PF_BATCH_SIZE) batches.push(prepared.rows.slice(offset, offset + PF_BATCH_SIZE));
    const started = Date.now();
    const run = function (dryRun) {
      const totals = { created: 0, updated: 0, unchanged: 0, dryRun: dryRun };
      batches.forEach(function (rows, index) {
        if (Date.now() - started > 240000) throw new Error('Exécution interrompue avant la limite de temps. Relancez syncNow() ; les IDs rendent la reprise sûre.');
        const result = pfSendBatch_(config, rows, dryRun, index + 1);
        totals.created += result.created;
        totals.updated += result.updated;
        totals.unchanged += result.unchanged;
      });
      return totals;
    };
    // Valider tous les lots avant d'écrire le premier ; une erreur n'est jamais ignorée.
    const preview = run(true);
    let result = preview;
    if (!config.dryRun) {
      // Un Sheet inchangé n'a besoin d'aucun appel d'écriture après la simulation complète.
      result = preview.created === 0 && preview.updated === 0
        ? { ...preview, dryRun: false } : run(false);
    }
    // Seulement des compteurs : ni email, ni ligne, ni ID, ni secret dans les logs.
    console.log('ProspectFlow : ' + JSON.stringify(result));
    return result;
  } finally { lock.releaseLock(); }
}

function installSyncTrigger() {
  // Fonction à lancer une seule fois après les tests. Remplace nos déclencheurs existants.
  removeSyncTriggers();
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(15).create();
}

function removeSyncTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'syncNow') ScriptApp.deleteTrigger(trigger);
  });
}

function pfConfig_(properties) {
  const endpoint = (properties.getProperty('PROSPECTFLOW_SYNC_URL') || '').trim();
  const secret = properties.getProperty('GOOGLE_SHEET_SYNC_SECRET') || '';
  const spreadsheetId = properties.getProperty('GOOGLE_SHEET_SPREADSHEET_ID') || '';
  const sheetId = properties.getProperty('GOOGLE_SHEET_TAB_ID') || '';
  const dryRun = properties.getProperty('DRY_RUN');
  if (!/^https:\/\/[a-zA-Z0-9.-]+(?::\d+)?\/api\/sync\/google-sheet$/.test(endpoint)
    || secret.length < 32 || secret.length > 256 || /\s/.test(secret)
    || !/^[a-zA-Z0-9_-]{20,200}$/.test(spreadsheetId) || !/^\d{1,12}$/.test(sheetId)
    || (dryRun !== null && !['true', 'false'].includes(dryRun))) {
    throw new Error('Configuration invalide. Vérifiez les propriétés du script, sans copier de secrets dans les logs.');
  }
  return { endpoint: endpoint, secret: secret, spreadsheetId: spreadsheetId, sheetId: sheetId, dryRun: dryRun !== 'false' };
}

function pfText_(value) { return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' '); }

function pfPrepareRows_(values) {
  const headers = (values[0] || []).map(pfText_);
  PF_HEADERS.forEach(function (header) {
    if (headers.filter(function (item) { return item === header; }).length !== 1) throw new Error('Colonne absente ou dupliquée : ' + header);
  });
  const idColumn = headers.indexOf('Prospect ID');
  const ids = values.slice(1).map(function (cells) { return [cells[idColumn] || '']; });
  const seenIds = new Set();
  const seenEmails = new Set();
  const seenCompanies = new Set();
  const rows = [];
  let idsChanged = false;
  values.slice(1).forEach(function (cells, index) {
    const get = function (header) { return pfText_(cells[headers.indexOf(header)]); };
    if (PF_HEADERS.slice(0, 7).every(function (header) { return !get(header); })) return;
    if (['Entreprise', 'Secteur', 'Ville'].some(function (header) { return !get(header); })) throw new Error('Ligne ' + (index + 2) + ' : Entreprise, Secteur et Ville sont obligatoires.');
    let id = get('Prospect ID').toLowerCase();
    if (!id) { id = Utilities.getUuid(); ids[index] = [id]; idsChanged = true; }
    if (!PF_UUID.test(id) || seenIds.has(id)) throw new Error('Ligne ' + (index + 2) + ' : Prospect ID invalide ou dupliqué.');
    seenIds.add(id);
    const email = get('Email').toLowerCase();
    const companyKey = JSON.stringify([get('Entreprise').toLowerCase(), get('Ville').toLowerCase()]);
    if ((email && seenEmails.has(email)) || seenCompanies.has(companyKey)) throw new Error('Ligne ' + (index + 2) + ' : entreprise ou email dupliqué dans le Sheet.');
    if (email) seenEmails.add(email);
    seenCompanies.add(companyKey);
    rows.push({ externalId: id, entreprise: get('Entreprise'), secteur: get('Secteur'), ville: get('Ville'),
      email: email, site_internet: get('Site internet'), statut: get('Statut'), prochaine_action: get('Prochaine action') });
  });
  return { rows: rows, ids: ids, idColumn: idColumn, idsChanged: idsChanged };
}

function pfSendBatch_(config, rows, dryRun, batchNumber) {
  const payload = JSON.stringify({ spreadsheetId: config.spreadsheetId, sheetId: config.sheetId, dryRun: dryRun, rows: rows });
  if (Utilities.newBlob(payload).getBytes().length > 512 * 1024) throw new Error('Lot trop volumineux. Réduisez PF_BATCH_SIZE.');
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = UrlFetchApp.fetch(config.endpoint, { method: 'post', contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + config.secret }, payload: payload,
        muteHttpExceptions: true, followRedirects: false });
    } catch {
      if (attempt < 2) { Utilities.sleep(1000 * Math.pow(2, attempt)); continue; }
      throw new Error('Lot ' + batchNumber + ' : réseau indisponible. Relancez syncNow().');
    }
    const status = response.getResponseCode();
    if ((status === 429 || status >= 500) && attempt < 2) { Utilities.sleep(1000 * Math.pow(2, attempt)); continue; }
    let result;
    try { result = JSON.parse(response.getContentText()); } catch { throw new Error('Lot ' + batchNumber + ' : réponse serveur invalide.'); }
    if (status !== 200) {
      // Ne jamais journaliser la réponse brute : seulement un code attendu de notre API.
      const code = typeof result.error === 'string' && /^[a-z_]+$/.test(result.error) ? result.error : 'sync_failed';
      const rowNumber = result.details && result.details[0] && result.details[0].row;
      const position = Number.isInteger(rowNumber) && rowNumber >= 1 && rowNumber <= rows.length ? ' (ligne du lot ' + rowNumber + ')' : '';
      throw new Error('Lot ' + batchNumber + ' : HTTP ' + status + ' / ' + code + position + '. Consultez le guide de synchronisation.');
    }
    if (result.dryRun !== dryRun || [result.created, result.updated, result.unchanged].some(function (count) { return !Number.isSafeInteger(count) || count < 0; })
      || result.created + result.updated + result.unchanged !== rows.length) throw new Error('Lot ' + batchNumber + ' : synchronisation non confirmée.');
    return result;
  }
  throw new Error('Lot ' + batchNumber + ' : synchronisation interrompue.');
}
