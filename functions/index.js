'use strict';
// Cloud Functions v2 do LGPDSAN (região southamerica-east1). Ver docs/FUNCTIONS.md.
const { setGlobalOptions } = require('firebase-functions/v2');
setGlobalOptions({ region: 'southamerica-east1' });

const audit = require('./src/audit');
const records = require('./src/records');
const evidence = require('./src/evidence');
const admin = require('./src/admin');
const configuration = require('./src/configuration');
const plans = require('./src/plans');

// auditoria disparada pelo navegador (lista fechada)
exports.logEvent = audit.logEvent;
// registros, versões e aprovação
exports.saveRecord = records.saveRecord;
exports.restoreRecordVersion = records.restoreRecordVersion;
exports.approveRecord = records.approveRecord;
exports.softDeleteRecord = records.softDeleteRecord;
exports.hardDeleteRecord = records.hardDeleteRecord;
// evidências
exports.reserveEvidence = evidence.reserveEvidence;
exports.finalizeEvidence = evidence.finalizeEvidence;
exports.cancelEvidenceReservation = evidence.cancelEvidenceReservation;
exports.reuseEvidence = evidence.reuseEvidence;
exports.deleteEvidence = evidence.deleteEvidence;
exports.cleanupEvidence = evidence.cleanupEvidence;
exports.adminCleanupEvidence = evidence.adminCleanupEvidence;
// administração
exports.adminSaveUser = admin.adminSaveUser;
exports.adminSetUserActive = admin.adminSetUserActive;
exports.adminRemoveUser = admin.adminRemoveUser;
exports.adminListUsers = admin.adminListUsers;
exports.adminSaveContabilidade = admin.adminSaveContabilidade;
exports.adminDeleteContabilidade = admin.adminDeleteContabilidade;
exports.adminRestoreContabilidade = admin.adminRestoreContabilidade;
exports.adminCategorias = admin.adminCategorias;
exports.adminMigrateLegacy = admin.adminMigrateLegacy;
// configuração versionada e planos de ação derivados no servidor
exports.getDiagnosticConfig = configuration.getDiagnosticConfig;
exports.saveDiagnosticConfig = configuration.saveDiagnosticConfig;
exports.refreshActionPlan = plans.refreshActionPlan;
exports.completeActionTask = plans.completeActionTask;
exports.getActionPlan = plans.getActionPlan;
