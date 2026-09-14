import base64
import importlib.util
import os
import unittest
from unittest.mock import patch
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import requests

spec = importlib.util.spec_from_file_location('delivery', 'api/deliver.py')
delivery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delivery)

class DeliveryTests(unittest.TestCase):
    def test_private_endpoint_authentication(self):
        with patch.dict(os.environ, {'CRON_SECRET': 'not-a-real-secret'}):
            self.assertFalse(delivery.authorized(None))
            self.assertFalse(delivery.authorized('Bearer wrong'))
            self.assertTrue(delivery.authorized('Bearer not-a-real-secret'))

    def test_rejects_header_injection_and_multiple_recipients(self):
        for value in ['a@example.com\r\nBcc: b@example.com', 'a@example.com,b@example.com', 'invalid']:
            with self.assertRaises(ValueError): delivery.validate_email(value)

    def test_push_rejects_private_and_arbitrary_endpoints(self):
        for url in ['http://127.0.0.1/push', 'https://169.254.169.254/metadata', 'https://example.com/push', 'https://fcm.googleapis.com.evil.test/push', 'https://fcm.googleapis.com:8080/push']:
            with self.assertRaises(ValueError): delivery.validate_subscription({'endpoint': url})

    def test_gmail_uses_tls_and_fixed_sender(self):
        calls = []
        messages = []
        class SMTP:
            def __init__(self, host, port, **kwargs):
                self_test.assertEqual((host, port), ('smtp.gmail.com', 465))
                self_test.assertTrue(kwargs['context'].check_hostname)
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def login(self, username, password): calls.append((username, password))
            def send_message(self, message):
                self_test.assertEqual(message['To'], 'recipient@example.com')
                self_test.assertEqual(message['From'], 'Life OS <sender@gmail.com>')
                messages.append(message)
        self_test = self
        with patch.dict(os.environ, {'GMAIL_ADDRESS': 'sender@gmail.com', 'GMAIL_APP_PASSWORD': 'test password'}):
            # 1. plain-text only email accepted
            result1 = delivery.deliver_email({'to': 'recipient@example.com', 'subject': 'Reminder', 'text': 'Test only', 'idempotencyKey': 'a'*64}, SMTP)
            self.assertEqual(result1, {'accepted': True})
            self.assertFalse(messages[0].is_multipart())
            self.assertEqual(messages[0].get_content().strip(), 'Test only')

            # 2. text + html accepted (multipart/alternative)
            result2 = delivery.deliver_email({'to': 'recipient@example.com', 'subject': 'Reminder', 'text': 'Test only', 'html': '<p>HTML test</p>', 'idempotencyKey': 'b'*64}, SMTP)
            self.assertEqual(result2, {'accepted': True})
            self.assertTrue(messages[1].is_multipart())
            parts = list(messages[1].iter_parts())
            self.assertEqual(len(parts), 2)
            self.assertEqual(parts[0].get_content_type(), 'text/plain')
            self.assertEqual(parts[1].get_content_type(), 'text/html')
        self.assertEqual(calls, [('sender@gmail.com', 'testpassword'), ('sender@gmail.com', 'testpassword')])

    def test_gmail_html_validation(self):
        class SMTP:
            def __init__(self, *args, **kwargs): pass
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def login(self, *args): pass
            def send_message(self, *args): pass

        with patch.dict(os.environ, {'GMAIL_ADDRESS': 'sender@gmail.com', 'GMAIL_APP_PASSWORD': 'test password'}):
            # 3. malformed/non-string or empty HTML rejected
            for bad_html in [123, True, [], {}, '', '   ', '\n\t']:
                with self.assertRaises(ValueError, msg=f"Should reject {bad_html!r}"):
                    delivery.deliver_email({'to': 'recipient@example.com', 'subject': 'Reminder', 'text': 'Test', 'html': bad_html, 'idempotencyKey': 'a'*64}, SMTP)

            # 4. excessive HTML size (>12000) rejected
            with self.assertRaises(ValueError):
                delivery.deliver_email({'to': 'recipient@example.com', 'subject': 'Reminder', 'text': 'Test', 'html': '<p>' + 'a'*12000 + '</p>', 'idempotencyKey': 'a'*64}, SMTP)

            # HTML within 12000 accepted
            valid_long_html = '<p>' + 'a'*11990 + '</p>'
            result = delivery.deliver_email({'to': 'recipient@example.com', 'subject': 'Reminder', 'text': 'Test', 'html': valid_long_html, 'idempotencyKey': 'c'*64}, SMTP)
            self.assertEqual(result, {'accepted': True})

    def test_real_webpush_encryption_without_network(self):
        encode = lambda value: base64.urlsafe_b64encode(value).decode().rstrip('=')
        vapid = ec.generate_private_key(ec.SECP256R1())
        browser = ec.generate_private_key(ec.SECP256R1())
        private = encode(vapid.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
        public = encode(browser.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
        subscription = {'endpoint': 'https://fcm.googleapis.com/wp/test', 'keys': {'p256dh': public, 'auth': encode(os.urandom(16))}}
        captured = []
        def request(session, method, url, **kwargs):
            captured.append(kwargs)
            response = requests.Response(); response.status_code = 201
            return response
        with patch.dict(os.environ, {'WEB_PUSH_PRIVATE_KEY': private, 'WEB_PUSH_PUBLIC_KEY': 'configured', 'WEB_PUSH_CONTACT': 'mailto:sender@example.com'}), patch.object(requests.Session, 'request', request):
            result = delivery.deliver_push({'subscription': subscription, 'body': 'Due task', 'tag': 'reminder'})
        self.assertEqual(result, {'accepted': True})
        self.assertFalse(captured[0]['allow_redirects'])
        self.assertNotIn(b'Due task', captured[0]['data'])

if __name__ == '__main__': unittest.main()
