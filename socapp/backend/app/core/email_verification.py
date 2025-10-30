# email_verification.py
import os
import logging
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

async def send_verification_email(email: str, verification_token: str):
    try:
        sg_api_key = os.getenv("SENDGRID_API_KEY")
        
        if not sg_api_key:
            logger.error("❌ SENDGRID_API_KEY not found in environment variables")
            return False

        base_url = os.getenv("BASE_URL", "https://socapp-2vpg.onrender.com")
        verification_url = f"{base_url}/auth/verify-email?token={verification_token}"
        
        logger.info(f"📧 Attempting to send email to: {email}")
        
        message = Mail(
            from_email='muddihilm58@gmail.com',
            to_emails=email,
            subject='Verify Your Email Address - Scc Social',
            html_content=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Welcome to Scc Social! 🎉</h2>
                <p>Thank you for registering! Please verify your email address to activate your account.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" 
                       style="background-color: #007bff; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                
                <p style="color: #666; font-size: 14px;">
                    Or copy and paste this link in your browser:<br>
                    <code style="background: #f5f5f5; padding: 5px; border-radius: 3px; word-break: break-all;">{verification_url}</code>
                </p>
            </div>
            """,
            plain_text_content=f"""
            Welcome to Scc Social!
            
            Thank you for registering! Please verify your email address to activate your account.
            
            Verify your email by clicking this link:
            {verification_url}
            
            If the button doesn't work, copy and paste the above URL into your web browser.
            """
        )
        
        sg = SendGridAPIClient(sg_api_key)
        response = sg.send(message)
        
        logger.info(f"✅ Email sent! Status Code: {response.status_code}")
        logger.info(f"📨 Response Body: {response.body}")
        logger.info(f"📋 Response Headers: {dict(response.headers)}")
        
        if response.status_code in [200, 202]:
            logger.info("🎯 Email accepted for delivery by SendGrid")
            return True
        else:
            logger.error(f"❌ SendGrid returned status: {response.status_code}")
            logger.error(f"❌ Response body: {response.body}")
            return False
            
    except Exception as e:
        logger.error(f"❌ SendGrid error: {str(e)}")
        if hasattr(e, 'body'):
            logger.error(f"❌ Error body: {e.body}")
        if hasattr(e, 'headers'):
            logger.error(f"❌ Error headers: {e.headers}")
        return False

def generate_verification_token():
    import secrets
    return secrets.token_urlsafe(32)