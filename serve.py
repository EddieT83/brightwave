import os
import http.server
import json
import smtplib
import socketserver
from email.message import EmailMessage

PORT = int(os.environ.get("PORT", 5500))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def load_env_file():
    env_path = os.path.join(DIRECTORY, ".env")

    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()

            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")

            if key and key not in os.environ:
                os.environ[key] = value

def send_json(handler, status_code, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)

def has_email_settings():
    return all(os.environ.get(key) for key in ("SMTP_HOST", "SMTP_USER", "SMTP_PASS"))

def send_contact_email(name, email, message):
    smtp_host = os.environ["SMTP_HOST"]
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    smtp_secure = os.environ.get("SMTP_SECURE", "false").lower() == "true"
    smtp_user = os.environ["SMTP_USER"]
    smtp_pass = os.environ["SMTP_PASS"]
    recipient = os.environ.get("CONTACT_TO", "dot.edwardtuttle@gmail.com")
    sender = os.environ.get("CONTACT_FROM", smtp_user)

    email_message = EmailMessage()
    email_message["From"] = sender
    email_message["To"] = recipient
    email_message["Reply-To"] = email
    email_message["Subject"] = f"Health plan inquiry from {name}"
    email_message.set_content(
        f"Name: {name}\nEmail: {email}\n\nProject details:\n{message}"
    )

    if smtp_secure:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(email_message)
    else:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(email_message)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path != "/api/contact":
            send_json(self, 404, {"error": "Not found."})
            return

        if not has_email_settings():
            send_json(self, 500, {"error": "Email service is not configured yet."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))

            if content_length > 10000:
                send_json(self, 413, {"error": "Message is too large."})
                return

            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (TypeError, ValueError, json.JSONDecodeError):
            send_json(self, 400, {"error": "Please send a valid message."})
            return

        name = str(payload.get("name", "")).strip()
        email = str(payload.get("email", "")).strip()
        message = str(payload.get("message", "")).strip()

        if not name or not email or not message:
            send_json(self, 400, {"error": "Please fill out every field."})
            return

        if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
            send_json(self, 400, {"error": "Please enter a valid email address."})
            return

        try:
            send_contact_email(name, email, message)
        except Exception as error:
            print(f"Contact email failed: {error}")
            send_json(self, 500, {"error": "The message could not be sent right now."})
            return

        send_json(self, 200, {"ok": True})

if __name__ == "__main__":
    load_env_file()
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving site from {DIRECTORY} at http://localhost:{PORT}")
        print("Press Ctrl+C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            httpd.server_close()
