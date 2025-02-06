const audio = document.getElementById('notificationSound');

const playSound = (type) => {
  if (!audio) {
    console.warn('Notification sound element not found');
    return;
  }
  
  audio.currentTime = 0; // Reset audio to start
  audio.play().catch(err => console.warn('Could not play notification sound:', err));
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
    console.warn('Notifications not supported');
    return false;
  }

  let permission = await Notification.requestPermission();
  
  if (permission === "granted") {
    localStorage.setItem('notificationsEnabled', 'true');
    // Test Notification
    const notification = new Notification("BambuCAM", {
      body: "Notifications enabled! 🔔",
      icon: '/printer-icon.png'
    });
    playSound('notification');
    setTimeout(() => notification.close(), 3000);
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