const cors = require('cors');
const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(cors({ origin: '*' })); // You can replace '*' with a specific origin if needed

const port = process.env.PORT || 3000;
const upload = multer({ dest: '/tmp/uploads' });

app.post('/compile', upload.single('plugin'), (req, res) => {
  const zipPath = req.file.path;
  const id = Date.now();
  const extractPath = `/tmp/plugin-${id}`;

  try {
    fs.mkdirSync(extractPath);

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    // Confirm required files exist
    if (!fs.existsSync(path.join(extractPath, 'pom.xml'))) {
      return res.status(400).json({ success: false, message: 'Missing pom.xml in root directory.' });
    }
    if (!fs.existsSync(path.join(extractPath, 'plugin.yml'))) {
      return res.status(400).json({ success: false, message: 'Missing plugin.yml in root directory.' });
    }

    // Compile with Maven
    exec(`mvn clean package`, { cwd: extractPath }, (error, stdout, stderr) => {
      if (error) {
        console.error('Build error:', stderr);
        return res.status(500).json({
          success: false,
          message: 'Compilation failed',
          log: stdout + '\n' + stderr
        });
      }

      // Locate .jar file in /target/
      const targetPath = path.join(extractPath, 'target');
      const files = fs.readdirSync(targetPath);
      const jar = files.find(f => f.endsWith('.jar'));

      if (!jar) {
        return res.status(500).json({
          success: false,
          message: 'No .jar file found after successful Maven build',
          log: stdout
        });
      }

      // Send the .jar back
      res.download(path.join(targetPath, jar));
    });
  } catch (e) {
    console.error('Unexpected server error:', e);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during preparation',
      error: e.message
    });
  }
});

app.listen(port, () => {
  console.log(`🔧 Plugin build service running on port ${port}`);
});
