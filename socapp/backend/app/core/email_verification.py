# email_verification.py
import resend
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Resend
resend.api_key = os.getenv("RESEND_API_KEY")

async def send_verification_email(email: str, verification_token: str):
    """
    Send verification email using Resend
    """
    try:
        # Check if API key is set
        if not resend.api_key:
            logger.error("❌ RESEND_API_KEY not found")
            return None

        base_url = os.getenv("BASE_URL", "https://socapp-2vpg.onrender.com")
        verification_url = f"{base_url}/auth/verify-email?token={verification_token}"
        
        logger.info(f"📧 Attempting to send verification email to: {email}")
        
        params = {
            "from": "Scc Social <onboarding@resend.dev>",  # Use resend.dev for testing
            "to": [email],
            "subject": "Verify Your Email Address",
            "html": f"""
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
                    <p>Or copy and paste this link in your browser:</p>
                    <p><code>{verification_url}</code></p>
                    <div class="footer">
                        <p>If you didn't create an account, please ignore this email.</p>
                    </div>
                </div>
            </body>
            </html>
            """
        }

        email_response = resend.Emails.send(params)
        logger.info(f"✅ Email sent successfully! Response: {email_response}")
        return email_response
        
    except Exception as e:
        logger.error(f"❌ Failed to send verification email: {str(e)}")
        return None

def generate_verification_token():
    """Generate a unique verification token"""
    import secrets
    return secrets.token_urlsafe(32)