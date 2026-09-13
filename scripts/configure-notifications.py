"""Run on your computer after pip install -r requirements.txt. Input stays local."""
import base64
import getpass
import json
import os
import secrets
from pathlib import Path
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

print('Life OS notification setup — values will be saved locally, not uploaded.')
address = input('Gmail sender address: ').strip()
password = getpass.getpass('Google app password (hidden): ').replace(' ', '')
if '@' not in address or len(password) != 16:
    raise SystemExit('Enter a valid sender and a 16-character Google app password.')
key = ec.generate_private_key(ec.SECP256R1())
encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
values = {
    'GMAIL_ADDRESS': address,
    'GMAIL_APP_PASSWORD': password,
    'WEB_PUSH_PUBLIC_KEY': encode(key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)),
    'WEB_PUSH_PRIVATE_KEY': encode(key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption())),
    'WEB_PUSH_CONTACT': 'mailto:' + address,
    'CRON_SECRET': secrets.token_urlsafe(32),
}
fd = os.open(Path('lifeos-notification-secrets.json'), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as file: json.dump(values, file, indent=2)
print('Saved lifeos-notification-secrets.json. Add these values to Vercel Production. Do not share or commit this file. Existing Firebase database credentials are still needed by reminder selection.')
