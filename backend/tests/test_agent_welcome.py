"""Website agent identity and greeting behavior."""
import unittest

from app.agents import default_settings, widget_welcome_message


class AgentWelcomeTests(unittest.TestCase):
    def setUp(self):
        self.agent = {"name": "VAC UI Assistant", "business_name": "VAC UI Components"}
        self.expected = "Hi, I'm Zenoxi, your VAC UI Components assistant. How can I help you today?"

    def test_new_agent_defaults_to_zenoxi_company_greeting(self):
        self.assertEqual(default_settings("VAC UI Assistant", "VAC UI Components")["welcome_message"], self.expected)

    def test_existing_agent_default_is_upgraded_for_widget(self):
        old = "Hi! 👋 I'm VAC UI Assistant, VAC UI Components's assistant. How can I help you today?"
        self.assertEqual(widget_welcome_message(self.agent, old), self.expected)

    def test_missing_greeting_uses_zenoxi_and_company_name(self):
        self.assertEqual(widget_welcome_message(self.agent, None), self.expected)

    def test_custom_greeting_is_preserved_after_zenoxi_identity(self):
        self.assertEqual(widget_welcome_message(self.agent, "Welcome! Ask about our components."),
                         self.expected + "\n\nWelcome! Ask about our components.")

    def test_already_branded_custom_greeting_is_preserved(self):
        greeting = "Hi, I'm Zenoxi. Ask me about VAC UI Components."
        self.assertEqual(widget_welcome_message(self.agent, greeting), greeting)


if __name__ == "__main__":
    unittest.main()
