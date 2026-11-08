"""Offline regression tests for the synthetic MFA client; uses public RFC vectors only."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('mfa_gate', Path(__file__).with_name('test-mfa.py'))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

class HelpersTest(unittest.TestCase):
    def test_rfc6238_sha1_six_digit_vectors(self):
        for timestamp, expected in [(59, '287082'), (1111111109, '081804'), (1111111111, '050471'), (1234567890, '005924')]:
            with self.subTest(timestamp=timestamp), patch.object(gate.time, 'time', return_value=timestamp):
                self.assertEqual(gate.otp('12345678901234567890'), expected)

    def test_form_parser_decodes_action_and_preserves_hidden_state(self):
        form = gate.Forms('<form action="https://sunnytech.cloud/login?a=1&amp;b=2"><input name="otp"><input type="hidden" name="state" value="synthetic"></form>').with_field('otp')
        self.assertEqual(form['action'], 'https://sunnytech.cloud/login?a=1&b=2')
        self.assertEqual(form['fields']['state'], 'synthetic')

    def test_code_before_mfa_is_rejected(self):
        with self.assertRaises(gate.GateError):
            gate.no_code('https://sunnytech.cloud/mfa-gate-callback?code=synthetic')

    def test_unapproved_destination_rejected_before_network(self):
        with self.assertRaises(gate.GateError):
            gate.Session().request('https://example.invalid/login')

    def test_redirect_cannot_send_session_to_unapproved_origin(self):
        with self.assertRaises(gate.GateError):
            gate.SafeRedirects().redirect_request(None, None, 302, '', {}, 'https://example.invalid/login')

if __name__ == '__main__':
    unittest.main()
