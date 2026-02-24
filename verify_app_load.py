from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:5174")
            page.goto("http://localhost:5174")

            # Wait for the login screen to appear
            # The login screen has "Mis Finanzas" text
            print("Waiting for 'Mis Finanzas' text...")
            page.wait_for_selector("text=Mis Finanzas", timeout=10000)

            print("Taking screenshot...")
            page.screenshot(path="verification_screenshot.png")
            print("Screenshot saved to verification_screenshot.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_screenshot.png")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
