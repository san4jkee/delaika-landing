<?php
// === НАСТРОЙКИ ===
$bot_token = '8164557152:AAHF_q--B2dRgFNvAx9h46mp7KJVuZkSeqk'; // ТВОЙ ТОКЕН
$chat_id   = '458094057'; // ТВОЙ CHAT_ID

// === ПОЛУЧАЕМ ДАННЫЕ ===
$email   = isset($_POST['email']) ? trim($_POST['email']) : '';
$message = isset($_POST['message']) ? trim($_POST['message']) : '';

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['status' => 'error', 'msg' => 'Неверный email']);
  exit;
}

// === СБОР СООБЩЕНИЯ ===
$telegram_message = "📩 Новая заявка с сайта:\n\n";
$telegram_message .= "✉️ Email: $email\n";
if ($message !== '') {
  $telegram_message .= "💬 Сообщение:\n$message";
}

// === ОТПРАВКА В TELEGRAM ===
$sendToTelegram = file_get_contents("https://api.telegram.org/bot{$bot_token}/sendMessage?" . http_build_query([
  'chat_id' => $chat_id,
  'text'    => $telegram_message,
  'parse_mode' => 'HTML'
]));

// === ОТВЕТ КЛИЕНТУ ===
http_response_code(200);
echo json_encode(['status' => 'ok', 'msg' => 'Сообщение отправлено']);
