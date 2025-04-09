const fs = require("fs");
const { execSync, spawn } = require("child_process");

const mode = process.argv[2];

if (!["dev", "start"].includes(mode)) {
  console.error("❌ Please provide mode: 'dev' or 'start'");
  process.exit(1);
}

const run = (cmd, cwd) => {
  return spawn(cmd, {
    cwd,
    shell: true,
    stdio: "inherit",
  });
};

// ------------------ CLIENT ------------------
function ensureClientReady() {
  const clientPath = "./client";
  const nodeModulesPath = `${clientPath}/node_modules`;

  if (!fs.existsSync(clientPath)) {
    console.error("❌ 'client' folder not found.");
    process.exit(1);
  }

  if (!fs.existsSync(nodeModulesPath)) {
    console.log("📦 Installing client dependencies...");
    try {
      execSync("npm install", { cwd: clientPath, stdio: "inherit" });
    } catch {
      console.error("❌ npm install failed in client/");
      process.exit(1);
    }
  }

  if (mode === "start") {
      console.log("📦 Building client...");
      execSync("npm run build", { cwd: clientPath, stdio: "inherit" });
    
    // Check and install 'serve' if not found
    try {
      execSync("serve -v", { stdio: "ignore" });
    } catch {
      console.log("🔧 Installing 'serve' globally...");
      try {
        execSync("npm install -g serve", { stdio: "inherit" });
      } catch {
        console.error("❌ Failed to install 'serve'. Please install it manually.");
        process.exit(1);
      }
    }
  }
}

// ------------------ SERVER ------------------
function ensureServerReady() {
  const serverPath = "./server";
  const vendorPath = `${serverPath}/vendor`;

  if (!fs.existsSync(serverPath)) {
    console.error("❌ 'server' folder not found.");
    process.exit(1);
  }

  if (!fs.existsSync(vendorPath)) {
    console.log("📦 Installing server dependencies...");
    try {
      execSync("composer install", { cwd: serverPath, stdio: "inherit" });
    } catch {
      console.error("❌ composer install failed in server/");
      process.exit(1);
    }
  }
}

// ------------------ RUN ------------------
function runDev() {
  console.log("🚀 Starting DEV mode...");
  run("npm run dev", "./client");
  run("php run.php", "./server");
}

function runStart() {
  console.log("🚀 Starting PROD mode...");
  run("php run.php", "./server");
  run("serve -s dist -l 5173", "./client");
}

// ------------------ MAIN ------------------
ensureClientReady();
ensureServerReady();

mode === "dev" ? runDev() : runStart();
