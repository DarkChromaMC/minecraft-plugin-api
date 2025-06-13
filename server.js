// server.js
const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const AdmZip   = require('adm-zip');
const fs       = require('fs');
const { exec } = require('child_process');
const path     = require('path');

const app    = express();
const upload = multer({ dest: '/tmp/uploads' });
const PORT   = process.env.PORT || 3000;

// Enable CORS everywhere, including preflight
app.use(cors());
app.options('*', cors());

app.get('/health', (_req, res) => res.send('OK'));

app.post('/compile', upload.single('plugin'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const zipPath = req.file.path;
  const workDir = `/tmp/build-${Date.now()}`;
  fs.mkdirSync(workDir, { recursive: true });

  // 1) Unzip
  try {
    new AdmZip(zipPath).extractAllTo(workDir, true);
  } catch (zipErr) {
    console.error('ZIP extraction failed:', zipErr);
    return res
      .status(400)
      .send(
        `Invalid ZIP archive. Must include pom.xml and src/ directory.\n\n` +
        zipErr.message
      );
  }

  // 2) Compile with verbose output
  exec(
    'mvn -B clean package',
    { cwd: workDir, maxBuffer: 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        // build the combined output safely
        const parts = [];
        if (stdout && stdout.trim()) parts.push(`STDOUT:\n${stdout}`);
        if (stderr && stderr.trim()) parts.push(`\nSTDERR:\n${stderr}`);
        const out = parts.length > 0 ? parts.join('\n') : err.message;

        console.error('Maven build failed:', out);
        return res
          .status(500)
          .send(`Build failed:\n\n${out}`);
      }

      // 3) success → return jar
      const target = path.join(workDir, 'target');
      let jar;
      try {
        jar = fs.readdirSync(target).find(f => f.endsWith('.jar'));
      } catch (fsErr) {
        return res
          .status(500)
          .send(
            `Build succeeded but could not list /target:\n\n` +
            fsErr.message
          );
      }

      if (!jar) {
        return res
          .status(500)
          .send('Build succeeded but no .jar found in target directory.');
      }

      res.download(path.join(target, jar), jar);
    }
  );
});

app.listen(PORT, () => {
  console.log(`🟢 Compiler listening on port ${PORT}`);
});
