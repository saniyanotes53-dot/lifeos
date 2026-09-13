/** Paste into a standalone Apps Script project. Store CRON_SECRET in Script Properties. */
function setupLifeOSReminders() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('CRON_SECRET')) throw new Error('Add CRON_SECRET in Project settings → Script properties first.');
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runLifeOSReminders').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runLifeOSReminders').timeBased().everyMinutes(1).create();
  console.log('Life OS trigger installed. No reminder was sent by setup.');
}
function stopLifeOSReminders() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runLifeOSReminders').forEach(t => ScriptApp.deleteTrigger(t));
}
function runLifeOSReminders() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('CRON_SECRET');
    if (!secret) throw new Error('CRON_SECRET is missing.');
    function invoke(path) {
      const response = UrlFetchApp.fetch('https://lifeos53.vercel.app' + path, {
        method: 'get', headers: {Authorization: 'Bearer ' + secret},
        muteHttpExceptions: true, followRedirects: false
      });
      if (response.getResponseCode() !== 200) throw new Error(path + ' failed with HTTP ' + response.getResponseCode());
    }
    // A due-task failure must not prevent the independently scheduled daily job.
    let dueError = null;
    try { invoke('/api/notify-due'); } catch (error) { dueError = error; }
    const day = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
    if (props.getProperty('DAILY_EMAILS_ENABLED') === 'true' && props.getProperty('LAST_DAILY_SUCCESS') !== day) {
      invoke('/api/reminder-emails');
      props.setProperty('LAST_DAILY_SUCCESS', day);
    }
    if (dueError) throw dueError;
  } finally { lock.releaseLock(); }
}
