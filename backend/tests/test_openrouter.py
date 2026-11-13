"""Offline failover tests; no real keys, network calls or AI quota required."""
import json
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from app import openrouter as router


def tokens(*events):
    return ''.join('data: ' + json.dumps(e) + '\n\n' for e in events) + 'data: [DONE]\n\n'


def chunk(text):
    return {"choices": [{"delta": {"content": text}}]}


class KeyFailoverTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        router._cooldowns.clear()
        self.calls = []
        self.settings = SimpleNamespace(openrouter_api_key='first', openrouter_api_key_2='second',
                                        openrouter_api_key_3='third', openrouter_model='openrouter/free',
                                        openrouter_base_url='https://example.invalid/api/v1')
        self.settings_patch = patch.object(router, 'settings', self.settings)
        self.settings_patch.start()
        self.client_class = httpx.AsyncClient
        self.client_patch = patch.object(router.httpx, 'AsyncClient', self.client)
        self.client_patch.start()
        self.handler = lambda request: httpx.Response(200, content=tokens(chunk('hello')))

    def tearDown(self):
        self.client_patch.stop()
        self.settings_patch.stop()
        router._cooldowns.clear()

    def client(self, **kwargs):
        def respond(request):
            self.calls.append(request.headers['Authorization'].removeprefix('Bearer '))
            self.assertEqual(json.loads(request.content)['model'], 'openrouter/free')
            return self.handler(request)
        return self.client_class(transport=httpx.MockTransport(respond), **kwargs)

    async def stream(self, **kwargs):
        return ''.join([t async for t in router.stream_chat([{'role': 'user', 'content': 'Hello'}], **kwargs)])

    async def test_daily_quota_switches_and_skips_until_reset(self):
        reset = int((time.time() + 3600) * 1000)
        def respond(request):
            if self.calls[-1] == 'first':
                return httpx.Response(429, json={'error': {'code': 429, 'metadata': {
                    'limit_source': 'openrouter_free_tier_daily', 'headers': {'X-RateLimit-Reset': str(reset)}}}})
            return httpx.Response(200, content=tokens({'choices': []}, chunk('backup'), chunk(' reply')))
        self.handler = respond
        self.assertEqual(await self.stream(), 'backup reply')
        self.assertEqual(self.calls, ['first', 'second'])
        self.assertAlmostEqual(router._cooldowns[router._fingerprint('first')][0], reset / 1000, delta=1)
        self.assertEqual(await self.stream(), 'backup reply')
        self.assertEqual(self.calls, ['first', 'second', 'second'])
        router._cooldowns[router._fingerprint('first')] = (time.time() - 1, 429)
        await self.stream()
        self.assertEqual(self.calls[-2:], ['first', 'second'])

    async def test_uses_third_key(self):
        self.handler = lambda r: httpx.Response(429, json={'error': {'code': 429}}) if self.calls[-1] != 'third' else httpx.Response(200, content=tokens(chunk('third reply')))
        self.assertEqual(await self.stream(), 'third reply')
        self.assertEqual(self.calls, ['first', 'second', 'third'])

    async def test_embedded_stream_error_switches_before_output(self):
        self.handler = lambda r: httpx.Response(200, content=tokens({'error': {'code': 429}})) if self.calls[-1] == 'first' else httpx.Response(200, content=tokens(chunk('backup')))
        self.assertEqual(await self.stream(), 'backup')
        self.assertEqual(self.calls, ['first', 'second'])

    async def test_partial_answer_never_mixes_with_backup(self):
        self.handler = lambda r: httpx.Response(200, content=tokens(chunk('partial'), {'error': {'code': 503}}))
        seen = []
        with self.assertRaises(httpx.HTTPStatusError):
            async for t in router.stream_chat([]):
                seen.append(t)
        self.assertEqual(seen, ['partial'])
        self.assertEqual(self.calls, ['first'])

    async def test_owner_private_key_does_not_use_shared_backups(self):
        self.handler = lambda r: httpx.Response(429, json={'error': {'code': 429}})
        with self.assertRaises(httpx.HTTPStatusError):
            await self.stream(api_key='owner-private')
        self.assertEqual(self.calls, ['owner-private'])

    async def test_resume_completion_uses_backup(self):
        expected = '{"name":"Example"}'
        self.handler = lambda r: httpx.Response(401, json={'error': {'code': 401}}) if self.calls[-1] == 'first' else httpx.Response(200, json={'choices': [{'message': {'content': expected}}]})
        self.assertEqual(await router.complete_chat([]), expected)
        self.assertEqual(self.calls, ['first', 'second'])

    async def test_network_failure_uses_backup(self):
        def respond(request):
            if self.calls[-1] == 'first':
                raise httpx.ConnectTimeout('offline', request=request)
            return httpx.Response(200, content=tokens(chunk('backup')))
        self.handler = respond
        self.assertEqual(await self.stream(), 'backup')

    async def test_empty_stream_uses_backup(self):
        self.handler = lambda r: httpx.Response(200, content=tokens()) if self.calls[-1] == 'first' else httpx.Response(200, content=tokens(chunk('backup')))
        self.assertEqual(await self.stream(), 'backup')

    async def test_all_quota_exhausted_returns_error_without_retrying_cooldowns(self):
        self.handler = lambda r: httpx.Response(429, json={'error': {'code': 429}})
        for _ in range(2):
            with self.assertRaises(httpx.HTTPStatusError) as error:
                await self.stream()
            self.assertEqual(error.exception.response.status_code, 429)
        self.assertEqual(self.calls, ['first', 'second', 'third'])

    async def test_bad_request_does_not_rotate(self):
        self.handler = lambda r: httpx.Response(400, json={'error': {'code': 400}})
        with self.assertRaises(httpx.HTTPStatusError):
            await self.stream()
        self.assertEqual(self.calls, ['first'])

    async def test_blank_and_duplicate_keys_ignored(self):
        self.settings.openrouter_api_key_2 = 'first'
        self.settings.openrouter_api_key_3 = '  '
        self.assertEqual(await self.stream(), 'hello')
        self.assertEqual(self.calls, ['first'])

    async def test_no_configured_key_fails_without_network(self):
        self.settings.openrouter_api_key = self.settings.openrouter_api_key_2 = self.settings.openrouter_api_key_3 = None
        with self.assertRaises(httpx.HTTPStatusError) as error:
            await self.stream()
        self.assertEqual(error.exception.response.status_code, 401)
        self.assertEqual(self.calls, [])

    async def test_plain_text_rate_limit_honors_retry_after(self):
        self.handler = lambda r: httpx.Response(429, text='rate limited', headers={'Retry-After': '120'}) if self.calls[-1] == 'first' else httpx.Response(200, content=tokens(chunk('backup')))
        self.assertEqual(await self.stream(), 'backup')
        until, status = router._cooldowns[router._fingerprint('first')]
        self.assertAlmostEqual(until - time.time(), 120, delta=1)
        self.assertEqual(status, 429)


if __name__ == '__main__':
    unittest.main()
