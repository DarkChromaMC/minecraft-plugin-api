const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const upload = multer({ dest: '/tmp/uploads' });

app.post('/compile', upload.single('plugin'), (req, res) => {
  const zipPath = req.file.path;
  const id = Date.now();
  const extractPath = `/tmp/plugin-${id}`;

  fs.mkdirSync(extractPath);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractPath, true);

  exec(`mvn clean package`, { cwd: extractPath }, (error, stdout, stderr) => {
    if (error) {
      console.error(stderr);
      return res.status(500).send(`Build failed:\n\n${stderr}`);
    }

    const targetPath = path.join(extractPath, 'target');
    const files = fs.readdirSync(targetPath);
    const jar = files.find(f => f.endsWith('.jar'));

    if (!jar) {
      return res.status(404).send('No .jar file found after compilation');
    }

    res.download(path.join(targetPath, jar));
  });
});

app.listen(port, () => console.log(`Backend service running on port ${port}`));
