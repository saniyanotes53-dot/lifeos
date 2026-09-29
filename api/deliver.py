"""Private transport endpoint. Reminder selection/receipts stay in the Node jobs."""
import hmac
import json
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, formatdate
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
    from_name = payload.get('fromName', 'Life OS')
    if not isinstance(from_name, str) or not 1 <= len(from_name) <= 100 or re.search(r'[\x00-\x1f\x7f]', from_name):
        raise ValueError('Invalid sender name.')
    message['From'] = formataddr((from_name, sender))
    message['Date'] = formatdate(localtime=False, usegmt=True)
    message['Auto-Submitted'] = 'auto-generated'
    if payload.get('replyTo'):
        message['Reply-To'] = validate_email(payload['replyTo'])
    unsubscribe = payload.get('unsubscribeUrl')
    if unsubscribe:
        if not isinstance(unsubscribe, str) or not re.fullmatch(r'https://lifeos53\.vercel\.app/api/reminder-emails\?unsubscribe=[a-f0-9]{64}\.[a-f0-9]{64}', unsubscribe):
            raise ValueError('Invalid reminder preferences URL.')
        message['List-Unsubscribe'] = '<' + unsubscribe + '>'
        message['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    message['To'] = recipient
    message['Subject'] = subject
    key = payload.get('idempotencyKey', '')
    if not re.fullmatch(r'[a-f0-9]{64}', key):
        raise ValueError('Missing delivery identifier.')
    message['Message-ID'] = f'<{key}@{sender.rsplit("@", 1)[1]}>'
    message.set_content(body)
    html = payload.get('html')
    if html is not None:
        if not isinstance(html, str) or not html.strip() or len(html) > 12000:
            raise ValueError('Invalid HTML email content.')
        message.add_alternative(html, subtype='html')
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


# ASGI application reuses the existing function URL and private authentication.
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from server.groq_transport import groq_request, ProviderError

app=FastAPI(docs_url=None,redoc_url=None,openapi_url=None)

@app.get('/api/deliver')
@app.get('/')
def status():
    from server.nutrition.engine import build_plan
    return JSONResponse({'service':'lifeos-python-delivery','framework':'FastAPI','nutritionReady':True,**configuration()},headers={'Cache-Control':'no-store'})

def dispatch(payload):
    channel=payload.get('channel')
    if channel=='nutrition':
        from server.nutrition.engine import build_plan
        return build_plan(payload.get('context',{}))
    if channel=='email':return deliver_email(payload)
    if channel=='push':return deliver_push(payload)
    if channel in ['groq','groq-test']:return groq_request(payload)
    raise ValueError('Unknown delivery channel')

@app.post('/api/deliver')
@app.post('/')
async def deliver(request:Request):
    headers={'Cache-Control':'no-store'}
    if not authorized(request.headers.get('authorization')):
        return JSONResponse({'error':'Unauthorized'},status_code=401,headers=headers)
    try:
        raw=bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw)>200000:return JSONResponse({'error':'Request too large'},status_code=413,headers=headers)
        payload=json.loads(raw)
        if not isinstance(payload,dict):raise ValueError('Invalid request')
        if payload.get('channel') not in ['groq','groq-test'] and len(raw)>32768:
            return JSONResponse({'error':'Request too large'},status_code=413,headers=headers)
        return JSONResponse(await run_in_threadpool(dispatch,payload),headers=headers)
    except ProviderError as error:
        return JSONResponse({'error':str(error)},status_code=error.status,headers=headers)
    except (ValueError,TypeError):
        return JSONResponse({'error':'Invalid private service request.'},status_code=400,headers=headers)
    except Exception:
        return JSONResponse({'error':'The private service could not complete this request. Please retry.'},status_code=502,headers=headers)
