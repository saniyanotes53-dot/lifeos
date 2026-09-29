"""Private Groq transport. Keys are decrypted only in server memory."""
import base64
import hashlib
import hmac
import json
import os
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class ProviderError(Exception):
    def __init__(self, status, message):
        self.status=status
        super().__init__(message)

def decrypt_key(sealed,secret=None):
    secret=secret or os.getenv('CRON_SECRET','')
    if len(secret)<32:raise ValueError('Encryption is not configured')
    parts=str(sealed).split('.')
    if len(parts)!=3:raise ValueError('Invalid encrypted credential')
    iv,body,tag=[base64.b64decode(p,validate=True) for p in parts]
    if len(iv)!=12 or len(tag)!=16:raise ValueError('Invalid encrypted credential')
    key=hmac.new(secret.encode(),b'lifeos-groq-vault-v1',hashlib.sha256).digest()
    return AESGCM(key).decrypt(iv,body+tag,b'lifeos:groq:v1').decode()

def groq_request(payload,opener=urlopen):
    key=decrypt_key(payload.get('sealedKey'))
    test=payload.get('channel')=='groq-test'
    body=payload.get('body') or {}
    model=payload.get('model') if test else body.get('model')
    if model not in ['openai/gpt-oss-20b','openai/gpt-oss-120b']:raise ValueError('Invalid model')
    url='https://api.groq.com/openai/v1/'+('models' if test else 'chat/completions')
    request=Request(url,data=None if test else json.dumps(body).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
    try:
        with opener(request,timeout=22) as response:data=json.load(response)
    except HTTPError as error:
        if error.code in [401,403]:raise ProviderError(400,'Groq rejected this key or its permissions. Check the key in your Groq account.') from None
        if error.code==429:raise ProviderError(429,'Groq usage limit reached. Please retry later.') from None
        raise ProviderError(502,'Groq is temporarily unavailable. Please retry.') from None
    if test:
        if model not in [m.get('id') for m in data.get('data',[])]:raise ProviderError(400,'This model is unavailable for your Groq account.')
        return {'accepted':True}
    content=data.get('choices',[{}])[0].get('message',{}).get('content')
    if not isinstance(content,str) or len(content)>40000:raise ProviderError(502,'Groq returned an incomplete response. Please retry.')
    return {'content':content}
