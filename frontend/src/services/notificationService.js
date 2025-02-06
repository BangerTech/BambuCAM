const audio = new Audio('/notification.mp3');

const playSound = (type) => {
  audio.play().catch(err => console.log('Sound konnte nicht abgespielt werden:', err));
};

export const showNotification = (printer, status) => {
  if (!("Notification" in window) || Notification.permission !== 'granted') {
    return;
  }

  const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
  if (!notificationsEnabled) return;

  const title = `Printer ${printer.name}`;
  let message = '';
  let icon = '/printer-icon.png';

  switch (status.toUpperCase()) {
    case 'COMPLETED':
      message = 'Print completed successfully!';
      playSound('success');
      break;
    case 'ERROR':
      message = 'Print failed! Please check the printer.';
      playSound('error');
      break;
    case 'CANCELLED':
      message = 'Print was cancelled.';
      playSound('notification');
      break;
    default:
      return;
  }

  const notification = new Notification(title, {
    body: message,
    icon,
    requireInteraction: true,
    silent: true // Wir nutzen eigene Sounds
  });

  // Schließe nach 10 Sekunden
  setTimeout(() => notification.close(), 10000);
};

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    return false;
  }

  let permission = await Notification.requestPermission();
  
  if (permission === "granted") {
    localStorage.setItem('notifications', 'enabled');
    showNotification(
      { name: "System" }, 
      "NOTIFICATION_TEST"
    );
    return true;
  }
  
  return false;
};

export const areNotificationsEnabled = () => {
  return (
    ("Notification" in window) &&
    Notification.permission === "granted" &&
    localStorage.getItem('notifications') === 'enabled'
  );
}; 