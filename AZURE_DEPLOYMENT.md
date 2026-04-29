# Beginner's Roadmap: Deploying to Azure via GitHub

This guide is written specifically for beginners. It will walk you through deploying this Computer Vision Data Dashboard to Microsoft Azure's Free Tier using **Automated GitHub Deployment (CI/CD)**. 

Since your code is already on GitHub (at `hamzabasharat26/Truck-turn-around-system`) and fully configured for Azure, you just need to follow these steps in your web browser.

---

## Phase 1: Create an Azure Web App (Free Tier)
First, we need to create a space on Azure's servers to host your application.

1. Go to the [Azure Portal](https://portal.azure.com/) and create a free account if you haven't already.
2. At the top search bar, search for **App Services** and click on it.
3. Click **+ Create** -> **Web App**.
4. Fill out the "Create Web App" form:
   * **Subscription**: The default free or pay-as-you-go subscription.
   * **Resource Group**: Click "Create new" and name it something like `cv-dashboard-rg`.
   * **Name**: Type a unique name (e.g., `truck-turnaround-app`). This will be your website link: `yourname.azurewebsites.net`.
   * **Publish**: Select **Code**.
   * **Runtime stack**: Select **Python 3.11** (or 3.10).
   * **Operating System**: Select **Linux**.
   * **Region**: Pick the default one closest to you.
   * **App Service Plan**: *CRITICAL STEP!* Look at the "Pricing plan" section. Make sure you select the **Free (F1)** tier so you don't get charged.
5. Click **Review + create** at the bottom, then click **Create**. Wait a minute for Azure to build the server.

---

## Phase 2: Link GitHub to Azure (Continuous Deployment)
Now we tell Azure to pull your code directly from your GitHub repository.

1. Once your Web App is created, click **"Go to resource"** (or find it in your App Services).
2. On the left-hand menu, scroll down to the **Deployment** section and click **Deployment Center**.
3. Under the "Source" dropdown, select **GitHub**.
4. Click the button to **Authorize / Sign in** to your GitHub account.
5. Once authorized, select your repository details:
   * **Organization**: `hamzabasharat26`
   * **Repository**: `Truck-turn-around-system`
   * **Branch**: `main`
6. Click **Save** at the top left.
   
*(What this does: Azure just created a secret hidden file in your GitHub repository called a "GitHub Actions Workflow". From now on, any time you change your code on GitHub, Azure will automatically download it and update your website!)*

---

## Phase 3: Crucial App Settings (For WebSockets & Video)
Your app uses `Flask-SocketIO` to show live data. By default, Azure blocks WebSockets. We must turn them on.

1. Still in your Web App on the Azure Portal, look at the left-hand menu again.
2. Scroll to the **Settings** section and click **Configuration**.
3. Click the **General settings** tab.
4. Scroll down to find **Web sockets** and select **On**.
5. Right above that, find the **Startup Command** text box. Type exactly this:
   `startup.sh`
   *(This tells Azure to use the custom startup script we made so it runs with `gunicorn` and `eventlet`.)*
6. Click **Save** at the top of the page, and click **Continue** when the warning pops up.

---

## Phase 4: Watch it Go Live!
Your deployment is now happening fully automatically in the background.

1. Go to your GitHub repository in your browser: [https://github.com/hamzabasharat26/Truck-turn-around-system](https://github.com/hamzabasharat26/Truck-turn-around-system)
2. Click the **Actions** tab at the top.
3. You will see a workflow running (a yellow spinning circle). Click on it to watch the live progress. 
4. Once it turns into a **Green Checkmark**, your deployment is complete!
5. Go to your web browser and type in your Azure website address: `https://<your-app-name>.azurewebsites.net`

---

## Phase 5: How to update your website in the future
Now that the pipeline is built, updating your live website is incredibly easy. All you have to do is push code from VS Code to GitHub:

1. Make a change to your code in VS Code.
2. Open your terminal and run:
   ```bash
   git add .
   git commit -m "Update dashboard colors"
   git push origin main
   ```
3. That's it! GitHub Actions will automatically see the `git push` and update your live Azure website within 2 minutes.