// Получаем текущего пользователя
const currentUsername = document.getElementById('currentUsername').value;

// Функция для автоматического изменения высоты textarea
function adjustTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

// Подключение к WebSocket
var socket = new SockJS('/ws');
var stompClient = Stomp.over(socket);

stompClient.connect({}, function (frame) {
    console.log('Connected: ' + frame);

    loadUnreadNotifications();

    stompClient.subscribe('/user/queue/notifications', function (message) {
        var notification = JSON.parse(message.body);
        addNotification(notification.message, notification.link, notification.id);
    });

    if (selectedChannelId) {
        stompClient.subscribe('/topic/channel/' + selectedChannelId, function (message) {
            var messageData = JSON.parse(message.body);
            const isOwnMessage = (messageData.senderUsername || messageData.sender?.username) === currentUsername;
            displayMessage(messageData, !isOwnMessage);
        });
    }

    if (selectedUser) {
        stompClient.subscribe('/user/queue/messages', function (message) {
            var messageData = JSON.parse(message.body);
            const isOwnMessage = (messageData.senderUsername || messageData.sender?.username) === currentUsername;

            // Отображаем сообщение в чате
            displayMessage(messageData, !isOwnMessage);

            // Если сообщение не от текущего пользователя — показываем уведомление
            if (!isOwnMessage) {
                showNotification(messageData.sender.displayName, messageData.content);
            }
        });
    }

});

// Основная функция отображения сообщений
function displayMessage(messageData, notify = false) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) {
        console.error("Message container not found!");
        return;
    }

    const sender = messageData.senderUsername || messageData.sender?.username;
    const isOwnMessage = sender === currentUsername;

    // Создаем основной контейнер сообщения
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `w-full flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`;

    // Создаем контейнер для содержимого сообщения
    const messageContent = document.createElement('div');
    messageContent.className = 'max-w-[320px]';

    // Создаем блок с текстом сообщения
    const messageTextBlock = document.createElement('div');
    messageTextBlock.className = `px-3 py-2 rounded-lg text-gray-800 dark:text-white/90 ${isOwnMessage
            ? 'bg-blue-500 text-white rounded-tr-sm'
            : 'bg-gray-100 dark:bg-white/5 rounded-tl-sm'
        }`;

    // Обрабатываем текст сообщения
    let messageText = messageData.content;
    if (typeof messageData.content === 'string' && messageData.content.startsWith('{') && messageData.content.endsWith('}')) {
        try {
            const contentData = JSON.parse(messageData.content);
            messageText = contentData.content || messageText;
        } catch (e) {
            console.warn("Failed to parse JSON:", e);
        }
    }

    // Добавляем текст сообщения
    const textElement = document.createElement('p');
    textElement.className = 'text-sm';
    textElement.textContent = messageText;
    messageTextBlock.appendChild(textElement);

    // Добавляем время отправки
    const timestampElement = document.createElement('p');
    timestampElement.className = 'mt-2 text-gray-500 text-theme-xs dark:text-gray-400';
    const now = new Date();
    timestampElement.textContent = formatMessageDate(now);

    // Собираем сообщение
    messageContent.appendChild(messageTextBlock);
    messageContent.appendChild(timestampElement);
    messageWrapper.appendChild(messageContent);
    messagesContainer.appendChild(messageWrapper);

    // Прокручиваем к последнему сообщению
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (notify && sender && !isOwnMessage) {
        showNotification(sender, messageText);
    }
}

// Дебаунс для звуков
let soundDebounceTimeout;
function debouncedPlaySound() {
    clearTimeout(soundDebounceTimeout);
    soundDebounceTimeout = setTimeout(() => {
        playNotificationSound();
    }, 500);
}

// Уведомления
const notificationsList = document.getElementById('notificationsList');
let noNotificationsElement = null;

function addNotification(message, link, notificationId) {
    if (noNotificationsElement && notificationsList.contains(noNotificationsElement)) {
        notificationsList.removeChild(noNotificationsElement);
        noNotificationsElement = null;
    }

    const li = document.createElement('li');
    li.className = 'notification-item block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5';

    const notificationLink = document.createElement('a');
    notificationLink.href = link;
    notificationLink.textContent = message;
    notificationLink.className = 'mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400';
    notificationLink.onclick = () => {
        markNotificationAsRead(notificationId, link);
    };

    li.appendChild(notificationLink);
    notificationsList.prepend(li);

    updateNotificationCount();
    debouncedPlaySound();
}

// Обновляем счётчик уведомлений
function updateNotificationCount() {
    const notificationCount = document.getElementById('notificationCount');
    const count = document.querySelectorAll('#notificationsList li.notification-item').length;
    notificationCount.textContent = count;
}

// Проверка на отсутствие уведомлений
function checkIfNoNotifications() {
    const markAllBtn = document.getElementById('markAllReadBtn');
    const hasNotifications = notificationsList.querySelectorAll('li.notification-item').length > 0;

    markAllBtn.style.display = hasNotifications ? 'block' : 'none';

    if (!hasNotifications) {
        noNotificationsElement = document.createElement('li');
        noNotificationsElement.textContent = 'Нет уведомлений';
        noNotificationsElement.className = 'py-2 px-4 text-gray-500 no-notifications';
        notificationsList.appendChild(noNotificationsElement);
    }
    updateNotificationCount();
}

// Пометка уведомления как прочитанного
function markNotificationAsRead(notificationId) {
    fetch(`/api/notifications/read/${notificationId}`, {
        method: 'POST'
    }).then(() => {
        const items = notificationsList.getElementsByTagName('a');
        for (let i = 0; i < items.length; i++) {
            if (items[i].href.endsWith(notificationId)) {
                notificationsList.removeChild(items[i].parentNode);
                break;
            }
        }

        updateNotificationCount();
        checkIfNoNotifications();
    }).catch(error => console.error('Ошибка при пометке уведомления:', error));
}

// Пометить все уведомления как прочитанные
function markAllNotificationsAsRead() {
    const btn = document.getElementById('markAllReadBtn');
    btn.disabled = true;
    btn.textContent = 'Обработка...';

    fetch("/api/notifications/read-all", {
        method: 'POST'
    })
        .then(response => {
            if (!response.ok) throw new Error('Ошибка при обновлении');
            notificationsList.innerHTML = '';
            checkIfNoNotifications();
            updateNotificationCount();
        })
        .catch(error => {
            console.error('Ошибка:', error);
            alert('Не удалось обновить уведомления');
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Прочитать все';
        });
}

// Загрузка непрочитанных уведомлений
function loadUnreadNotifications() {
    fetch("/api/notifications/unread")
        .then(response => response.json())
        .then(data => {
            notificationsList.innerHTML = '';
            data.forEach(notification => {
                addNotification(notification.message, notification.link, notification.id);
            });
            checkIfNoNotifications();
        });
}

// Обработка отправки формы
document.addEventListener('DOMContentLoaded', function () {
    const messageForm = document.getElementById('messageForm');
    const channelMessageForm = document.getElementById('channelMessageForm');
    const messageInput = document.getElementById('messageContent');

    // Автоматическое изменение высоты textarea
    if (messageInput) {
        messageInput.addEventListener('input', function () {
            adjustTextareaHeight(this);
        });
    }

    if (messageForm) {
        messageForm.addEventListener('submit', function (event) {
            event.preventDefault();
            sendDirectMessage();
        });
    }

    if (channelMessageForm) {
        channelMessageForm.addEventListener('submit', function (event) {
            event.preventDefault();
            sendChannelMessage();
        });
    }

    if (messageInput) {
        messageInput.addEventListener('keydown', function (event) {
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                if (selectedChannelId) {
                    sendChannelMessage();
                } else if (selectedUser) {
                    sendDirectMessage();
                }
            }
        });
    }
});

// Отправка сообщения в канал
function sendChannelMessage() {
    const messageInput = document.getElementById('messageContent');
    const messageContent = messageInput.value.trim();

    if (!messageContent) return;

    if (selectedChannelId) {
        stompClient.send(`/app/channel/${selectedChannelId}`, {}, messageContent);

        messageInput.value = '';
        messageInput.focus();
    }
}

// Отправка личного сообщения
function sendDirectMessage() {
    const messageInput = document.querySelector('#messageForm textarea');
    if (!messageInput) {
        console.error('Поле ввода сообщения не найдено');
        return;
    }

    const messageContent = messageInput.value.trim();
    if (!messageContent) {
        return;
    }

    // Получаем имя получателя из скрытого input в форме
    const receiverInput = document.querySelector('#messageForm input[name="receiverUsername"]');
    if (!receiverInput) {
        console.error('Поле с получателем сообщения не найдено');
        return;
    }

    const receiverUsername = receiverInput.value;

    try {
        // Отправляем через WebSocket
        stompClient.send("/app/messages/sendDirectMessage", {}, JSON.stringify({
            content: messageContent,
            receiverUsername: receiverUsername
        }));

        // Очищаем поле ввода
        messageInput.value = '';
        messageInput.focus();
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const messageInput = document.querySelector('#messageForm textarea');
    if (messageInput) {
        messageInput.addEventListener('keydown', function (event) {
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                sendDirectMessage();
            }
        });
    }
});


// Подписка на канал
if (typeof selectedChannelId !== 'undefined' && selectedChannelId) {
    stompClient.subscribe(`/topic/channel/${selectedChannelId}`, function (message) {
        const messageData = JSON.parse(message.body);
        displayMessage(messageData, true);
    });
}

// Подписка на личные сообщения
if (typeof selectedUser !== 'undefined' && selectedUser) {
    stompClient.subscribe('/user/queue/messages', function (message) {
        const messageData = JSON.parse(message.body);
        displayMessage(messageData, true);
    });
}

// Вызов загрузки уведомлений при загрузке страницы
window.onload = loadUnreadNotifications;

// Отправка комментария сочетанием клавиш ctrl + Enter
document.addEventListener('DOMContentLoaded', function () {
    const commentInput = document.getElementById('commentInput');
    const commentForm = document.getElementById('commentForm');
    if (commentInput && commentForm) {
        commentInput.addEventListener('keydown', function (event) {
            if (event.ctrlKey && event.key === 'Enter') {
                commentForm.submit();
            }
        });
    }
});

// Открытие модального окна
function openModal(src) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const downloadLink = document.getElementById('downloadLink');

    modalImage.src = src;
    downloadLink.href = src;

    modal.classList.remove('hidden');
    document.getElementById('closeModal').focus();
}

document.getElementById('closeModal').addEventListener('click', function () {
    document.getElementById('imageModal').classList.add('hidden');
});

// Функция для воспроизведения звука уведомления
function playNotificationSound() {
    // Создаем аудио элементы для разных типов уведомлений
    const notificationSound = new Audio('/static/sounds/notification.wav');
    const messageSound = new Audio('/static/sounds/message.wav');
    const commentSound = new Audio('/static/sounds/comment.wav');

    // Определяем тип уведомления и воспроизводим соответствующий звук
    if (selectedChannelId) {
        // Для сообщений в канале
        messageSound.play().catch(error => console.log('Ошибка воспроизведения звука:', error));
    } else if (selectedUser) {
        // Для личных сообщений
        notificationSound.play().catch(error => console.log('Ошибка воспроизведения звука:', error));
    } else {
        // Для комментариев
        commentSound.play().catch(error => console.log('Ошибка воспроизведения звука:', error));
    }
}

// Функция для отображения уведомлений
function showNotification(sender, message) {
    // Создаем элемент уведомления
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 max-w-sm z-50 border border-gray-200 dark:border-gray-700';

    // Создаем заголовок уведомления
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-2';

    const title = document.createElement('h3');
    title.className = 'text-sm font-semibold text-gray-900 dark:text-white';
    title.textContent = `Новое сообщение от ${sender}`;

    const closeButton = document.createElement('button');
    closeButton.className = 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => notification.remove();

    header.appendChild(title);
    header.appendChild(closeButton);

    // Создаем текст уведомления
    const content = document.createElement('p');
    content.className = 'text-sm text-gray-600 dark:text-gray-300';
    content.textContent = message;

    // Собираем уведомление
    notification.appendChild(header);
    notification.appendChild(content);

    // Добавляем уведомление на страницу
    document.body.appendChild(notification);

    // Автоматически удаляем уведомление через 5 секунд
    setTimeout(() => {
        notification.remove();
    }, 5000);
}