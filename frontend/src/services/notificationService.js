import logger from '../utils/logger';

const audio = document.getElementById('notificationSound');

const playSound = (type) => {
  if (!audio) {
    console.warn('Notification sound element not found');
    return;
  }
  
  audio.currentTime = 0; // Reset audio to start
  audio.play().catch(err => console.warn('Could not play notification sound:', err));
};

export const showNotification = async (printer, status) => {
  logger.notification('Showing notification:', { printer, status });
  const notificationsEnabled = localStorage.getItem('notificationsEnabled') === 'true';
  if (!notificationsEnabled) return;

  try {
    const response = await fetch(`${API_URL}/notifications/whatsapp/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        printer_name: printer.name,
        status: status
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send WhatsApp notification');
    }
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
  }
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