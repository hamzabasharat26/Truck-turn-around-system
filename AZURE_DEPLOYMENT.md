# Azure Deployment Guide

This guide provides step-by-step instructions to deploy this Computer Vision Data Dashboard to **Microsoft Azure's Free Tier** via a ZIP file deployment.

## Prerequisites
1. An active [Microsoft Azure account](https://portal.azure.com/).
2. [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed on your local machine.

---

## Step 1: Project Preparation (Already Completed)
The project code has been tailored for Azure Linux App Services:
* **`requirements.txt`**: 
  * Replaced `opencv-python` with `opencv-python-headless` because Azure Linux environments lack GUI dependencies (`libGL.so.1`).
  * Added `gunicorn` to act as the production web server.
  * Added `eventlet` to support asynchronous workers for SocketIO.
* **`startup.sh`**: Added a startup command (`gunicorn --worker-class eventlet -w 1 app:app`) to tell Azure how to boot the server with WebSockets capability.

---

## Step 2: Create Azure Resources using Azure CLI
Open your terminal (PowerShell or Bash) and run the following commands:

**1. Login to Azure:**
```bash
az login
```

**2. Create a Resource Group:**
Replace `<Your-Resource-Group>` with a name like `cv-dashboard-rg`.
```bash
az group create --name <Your-Resource-Group> --location eastus
```

**3. Create an App Service Plan (Free Tier):**
Replace `<Your-Plan-Name>` with a name like `cv-dashboard-plan`. 
_Using `--sku F1` ensures you will not be charged._
```bash
az appservice plan create --name <Your-Plan-Name> --resource-group <Your-Resource-Group> --sku F1 --is-linux
```

**4. Create the Web App:**
Replace `<Your-App-Name>` with a globally unique name (e.g., `my-cv-dashboard-app`).
```bash
az webapp create --resource-group <Your-Resource-Group> --plan <Your-Plan-Name> --name <Your-App-Name> --runtime "PYTHON:3.11"
```

---

## Step 3: Package the App

Zip the contents of your project folder. 
**Important:** Do NOT zip the parent folder itself. Go into your project folder (`TA - Copy first`), select all files (`app.py`, `requirements.txt`, `startup.sh`, `static`, `templates`, etc.), and create the zip archive directly from them. Name it `release.zip`.

---

## Step 4: Deploy the ZIP File

Run the following command to securely upload and deploy your zipped project code to Azure:
```bash
az webapp deploy --resource-group <Your-Resource-Group> --name <Your-App-Name> --src-path release.zip
```
*(Wait 1-2 minutes for Azure to upload, extract, and install the libraries listed in `requirements.txt`)*

---

## Step 5: Post-Deployment Configuration
Because this application uses real-time WebSockets (`Flask-SocketIO`), you must configure two settings in Azure before the app will work.

**1. Set the Startup Command:**
Tell Azure to use the `startup.sh` file we created.
```bash
az webapp config set --resource-group <Your-Resource-Group> --name <Your-App-Name> --startup-file "startup.sh"
```

**2. Turn on WebSockets:**
Enable the WebSocket protocol on the App Service.
```bash
az webapp config set --resource-group <Your-Resource-Group> --name <Your-App-Name> --web-sockets-enabled true
```

---

## Step 6: Access Your Deployed App!
Restart your app to ensure all settings take effect:
```bash
az webapp restart --resource-group <Your-Resource-Group> --name <Your-App-Name>
```

Open a web browser and navigate to:
**`https://<Your-App-Name>.azurewebsites.net`**