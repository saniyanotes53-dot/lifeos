"""Private transport endpoint. Reminder selection/receipts stay in the Node jobs."""
import hmac
import json
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse


def configuration():
    return {
        'emailConfigured': bool(os.getenv('GMAIL_ADDRESS') and os.getenv('GMAIL_APP_PASSWORD')),
        'pushConfigured': bool(os.getenv('WEB_PUSH_PRIVATE_KEY') and os.getenv('WEB_PUSH_PUBLIC_KEY') and os.getenv('WEB_PUSH_CONTACT')),
    }


def authorized(header):
    secret = os.getenv('CRON_SECRET', '')
    return bool(secret) and hmac.compare_digest(header or '', 'Bearer ' + secret)


def validate_email(value):
    if not isinstance(value, str) or len(value) > 254 or not re.fullmatch(r'[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+', value):
        raise ValueError('Invalid recipient email.')
    return value


def validate_subscription(subscription):
    if not isinstance(subscription, dict):
        raise ValueError('Invalid browser subscription.')
    parsed = urlparse(subscription.get('endpoint', ''))
    host = parsed.hostname or ''
    allowed = host in {'fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'} or host.endswith('.push.services.mozilla.com')
    if parsed.scheme != 'https' or not allowed or parsed.port not in (None, 443) or parsed.username or parsed.password or parsed.fragment:
        raise ValueError('Unsupported browser push endpoint.')
    keys = subscription.get('keys', {})
    if not all(isinstance(keys.get(k), str) and re.fullmatch(r'[A-Za-z0-9_=-]{16,200}', keys[k]) for k in ('auth', 'p256dh')):
        raise ValueError('Invalid browser encryption keys.')
    return subscription


def deliver_email(payload, smtp_factory=smtplib.SMTP_SSL):
    if not configuration()['emailConfigured']:
        raise RuntimeError('Gmail SMTP is not configured.')
    recipient = validate_email(payload.get('to'))
    sender = validate_email(os.environ['GMAIL_ADDRESS'])
    subject, body = payload.get('subject'), payload.get('text')
    if not isinstance(subject, str) or not 1 <= len(subject) <= 160 or '\r' in subject or '\n' in subject or not isinstance(body, str) or not 1 <= len(body) <= 6000:
        raise ValueError('Invalid email content.')
    message = EmailMessage()
    message['From'] = f'Life OS <{sender}>'
    message['To'] = recipient
    message['Subject'] = subject
    key = payload.get('idempotencyKey', '')
    if not re.fullmatch(r'[a-f0-9]{64}', key):
        raise ValueError('Missing delivery identifier.')
    message['Message-ID'] = f'<{key}@lifeos53.vercel.app>'
    message.set_content(body)
    with smtp_factory('smtp.gmail.com', 465, context=ssl.create_default_context(), timeout=12) as smtp:
        smtp.login(sender, os.environ['GMAIL_APP_PASSWORD'].replace(' ', ''))
        smtp.send_message(message)
    return {'accepted': True}


def deliver_push(payload):
    if not configuration()['pushConfigured']:
        raise RuntimeError('Web Push is not configured.')
    subscription = validate_subscription(payload.get('subscription'))
    body, tag = payload.get('body'), payload.get('tag')
    if not isinstance(body, str) or len(body) > 1000 or not isinstance(tag, str) or len(tag) > 100:
        raise ValueError('Invalid notification content.')
    from pywebpush import webpush, WebPushException
    import requests

    class NoRedirectSession(requests.Session):
        def request(self, method, url, **kwargs):
            kwargs['allow_redirects'] = False
            return super().request(method, url, **kwargs)

    try:
        with NoRedirectSession() as session:
            response = webpush(subscription_info=subscription,
                data=json.dumps({'title': 'Life OS reminder', 'body': body, 'tag': tag}),
                vapid_private_key=os.environ['WEB_PUSH_PRIVATE_KEY'],
                vapid_claims={'sub': os.environ['WEB_PUSH_CONTACT']},
                ttl=300, timeout=12, requests_session=session)
        if not 200 <= response.status_code < 300:
            raise RuntimeError('Push provider did not accept the notification.')
        return {'accepted': True}
    except WebPushException as error:
        if error.response is not None and error.response.status_code in (404, 410):
            return {'expired': True}
        raise RuntimeError('Browser push provider rejected the notification.') from None


class handler(BaseHTTPRequestHandler):
    def respond(self, status, payload):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def do_GET(self):
        self.respond(200, {'service': 'lifeos-python-delivery', **configuration()})

    def do_POST(self):
        if not authorized(self.headers.get('Authorization')):
            return self.respond(401, {'error': 'Unauthorized'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 16000:
                return self.respond(413, {'error': 'Invalid request size.'})
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError('Invalid request.')
            if payload.get('channel') == 'email':
                result = deliver_email(payload)
            elif payload.get('channel') == 'push':
                result = deliver_push(payload)
            else:
                raise ValueError('Unknown delivery channel.')
            self.respond(200, result)
        except (ValueError, TypeError):
            self.respond(400, {'error': 'Invalid delivery request.'})
        except Exception as error:
            # Never log credentials, recipients, content or provider response bodies.
            print('[delivery.failed]', type(error).__name__)
            self.respond(502, {'error': 'Delivery failed. Check sender configuration and provider limits.'})
