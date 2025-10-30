# email_verification.py
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

async def send_verification_email(email: str, verification_token: str):
    """
    Send verification email using Gmail SMTP
    """
    try:
        # Gmail SMTP configuration
        smtp_server = "smtp.gmail.com"
        port = 587
        sender_email = os.getenv("GMAIL_EMAIL")  # Your Gmail address
        password = os.getenv("GMAIL_APP_PASSWORD")  # Gmail app password
        
        if not sender_email or not password:
            logger.error("❌ Gmail credentials not configured")
            return None

        verification_url = f"https://socapp-2vpg.onrender.com/auth/verify-email?token={verification_token}"
        
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = "Verify Your Email Address"
        message["From"] = f"Scc Social <{sender_email}>"
        message["To"] = email
        
        # Create HTML content
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .button {{ display: inline-block; padding: 12px 24px; background-color: #007bff; 
                        color: white; text-decoration: none; border-radius: 4px; }}
                .footer {{ margin-top: 20px; font-size: 14px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Verify Your Email Address</h2>
                <p>Thank you for registering! Please click the button below to verify your email address:</p>
                <p>
                    <a href="{verification_url}" class="button">Verify Email</a>
                </p>
            </div>
        </body>
        </html>
        """
        
        message.attach(MIMEText(html, "html"))
        
        # Send email
        with smtplib.SMTP(smtp_server, port) as server:
            server.starttls()
            server.login(sender_email, password)
            server.sendmail(sender_email, email, message.as_string())
        
        logger.info(f"✅ Verification email sent to: {email}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Failed to send verification email: {str(e)}")
        return None

def generate_verification_token():
    """Generate a unique verification token"""
    import secrets
    return secrets.token_urlsafe(32)