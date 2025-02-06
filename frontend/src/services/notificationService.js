// Sound-Dateien importieren
const successSound = new Audio('/sounds/success.mp3');  // z.B. sanfter "Ding" Sound
const errorSound = new Audio('/sounds/error.mp3');      // z.B. wichtiger "Bong" Sound

const showNotification = (printer, status) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
  if (!notificationsEnabled) return;

  const title = `Printer ${printer.name}`;
  let message = '';
  let icon = '/notification-icon.png';
  let sound = null;

  switch (status.toUpperCase()) {
    case 'FAILED':
    case 'ERROR':
    case 'BLOCKED':
      message = `Print failed: ${status}! Please check the printer.`;
      sound = errorSound;
      break;
    case 'FINISHED':
      message = 'Print completed successfully!';
      sound = successSound;
      break;
    default:
      return;
  }

  // Zeige Notification
  new Notification(title, {
    body: message,
    icon,
    badge: icon,
    silent: false,  // Browser-eigener Sound
    requireInteraction: true,
    data: { printer },
    vibrate: [200, 100, 200]
  });

  // Spiele zusätzlichen Sound ab
  if (sound) {
    sound.play().catch(err => console.log('Sound konnte nicht abgespielt werden:', err));
  }
};

export { showNotification }; 