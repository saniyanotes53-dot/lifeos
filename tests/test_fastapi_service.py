import importlib.util
import os
import subprocess
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from server.groq_transport import decrypt_key

spec=importlib.util.spec_from_file_location('delivery_api','api/deliver.py')
service=importlib.util.module_from_spec(spec)
spec.loader.exec_module(service)

class PrivateServiceTests(unittest.TestCase):
    def test_node_python_encryption_compatibility(self):
        script="import {sealKey} from './server/integration-vault.js'; console.log(sealKey('gsk_test_only_not_a_real_key','x'.repeat(40)));"
        sealed=subprocess.check_output(['node','--input-type=module','-e',script],text=True).strip()
        self.assertEqual(decrypt_key(sealed,'x'*40),'gsk_test_only_not_a_real_key')
        with self.assertRaises(Exception):decrypt_key(sealed,'y'*40)

    def test_private_transport_auth_limits_and_dispatch(self):
        with patch.dict(os.environ,{'CRON_SECRET':'x'*40}):
            client=TestClient(service.app)
            self.assertEqual(client.post('/api/deliver',json={}).status_code,401)
            self.assertEqual(client.get('/docs').status_code,404)
            headers={'Authorization':'Bearer '+'x'*40}
            self.assertEqual(client.post('/api/deliver',content='broken',headers=headers).status_code,400)
            self.assertEqual(client.post('/api/deliver',content='x'*200001,headers=headers).status_code,413)
            with patch.object(service,'dispatch',return_value={'ready':True}) as dispatch:
                result=client.post('/api/deliver',json={'channel':'nutrition'},headers=headers)
                self.assertEqual(result.json(),{'ready':True})
                dispatch.assert_called_once_with({'channel':'nutrition'})
