# NoHarm Survey Project

NoHarm is a web-based survey application designed to collect and analyze user responses efficiently. This guide provides step-by-step instructions for setting up and running the application locally, as well as deployment details for updating the production server.

## 🔗 Live Version
The NoHarm survey is accessible online at:  
➡️ **[NoHarm Survey Live](https://noharm.sc.hpi.de/)**

---

## 📌 Prerequisites

Before setting up the project, ensure you have the following installed:

- **Python** (3.8+): [Download Python](https://www.python.org/downloads/)
- **pip**: Comes pre-installed with Python
- **git**: [Download Git](https://git-scm.com/downloads)

---

## 🛠️ Setup Instructions (Local Development)

Follow these steps to set up and run NoHarm on your local machine.

### 1️⃣ Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/abralurrahman/NoHarm.git
cd NoHarm
```

### 2️⃣ Create and Activate a Virtual Environment

Set up a virtual environment to manage dependencies:

```bash
python -m venv venv
```

#### ➤ Activate the Virtual Environment:

- **Windows (PowerShell)**:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  .\venv\Scripts\Activate.ps1
  ```

- **Windows (CMD)**:
  ```cmd
  .\venv\Scripts\activate
  ```

- **Mac/Linux**:
  ```bash
  source venv/bin/activate
  ```

When activated, your terminal will display `(venv)` at the start of the line.

### 3️⃣ Install Dependencies

With the virtual environment activated, install the required dependencies:

```bash
pip install -r requirements.txt
```

### 4️⃣ Initialize the Database

Run the following command to set up the database:

```bash
python init_db.py
```

This will create a new database for storing survey responses.

### 5️⃣ Start the Application

Run the NoHarm web application:

```bash
python app.py
```

The application will be available at:

```
http://127.0.0.1:5000/
```

To stop the server, use `CTRL + C` in the terminal.

---

## 🚀 Deployment & Server Update Guide

To deploy a new version of the NoHarm application on the production server, follow these steps.

### 1️⃣ Connect to the HPI VPN [Outside HPI]
#### If you are in the HPI network, skip 1️⃣ & 2️⃣.

Before accessing the production server, connect to the **HPI VPN**:

1. **Download and install** Checkpoint VPN: [Checkpoint VPN Download](https://www.checkpoint.com/quantum/remote-access-vpn/)
2. **Connect using VPN host**: `vpn.hpi.de`
3. **Login with your HPI credentials** (required when outside the HPI network).

### 2️⃣ Access the Production Server

Once connected to the VPN, open a terminal and SSH into the NoHarm server:

```bash
ssh your_hpi_username@vm-noharm.cloud.dhclab.i.hpi.de
```

Replace `your_hpi_username` with your actual HPI account username.

### 3️⃣ Update the Application

Navigate to the NoHarm project directory:

```bash
cd ~/noharm/NoHarm
```

Pull the latest changes from GitHub:

```bash
git reset --hard
git pull origin main
```

### 4️⃣ Restart the Application

1. **Activate the Virtual Environment:**
   ```bash
   source venv/bin/activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Reinitialize the Database:**
   ```bash
   python init_db.py
   ```

4. **Restart the NoHarm Service:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart noharm.service
   ```

5. **Check Service Status:**
   ```bash
   sudo systemctl status noharm.service
   ```

### 5️⃣  Check mock API output

https://webhook.site/#!/view/c4f75040-f408-45b0-8d99-44bca147ba58
   

If the service is running correctly, NoHarm should be updated and live at:  
➡️ **[https://noharm.dhc-lab.hpi.de/](https://noharm.dhc-lab.hpi.de/)**

---

## 📧 Contact

For any questions or support, feel free to reach out

---


