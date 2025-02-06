import printerIcon from '../assets/printer-icon.png';
import notificationSound from '../assets/notification.mp3';

const audio = new Audio(notificationSound);

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

export const showNotification = (title, message) => {
  if (!("Notification" in window)) {
    console.log("Browser unterstützt keine Benachrichtigungen");
    return;
  }

  // Prüfe ob Benachrichtigungen aktiviert sind
  if (localStorage.getItem('notifications') !== 'enabled') {
    return;
  }

  // Zeige Benachrichtigung
  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body: message,
      icon: printerIcon,
      silent: true // Wir nutzen unseren eigenen Sound
    });
    
    // Sound abspielen
    audio.play();
    
    // Notification nach 5 Sekunden schließen
    setTimeout(() => notification.close(), 5000);
  }
};

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    return false;
  }

  let permission = await Notification.requestPermission();
  
  if (permission === "granted") {
    localStorage.setItem('notifications', 'enabled');
    // Test-Benachrichtigung
    showNotification(
      "Benachrichtigungen aktiviert", 
      "Sie werden nun über wichtige Drucker-Ereignisse informiert"
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

export { showNotification }; 