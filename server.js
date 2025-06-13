import express from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';

const app = express();
const upload = multer({ dest: '/tmp/uploads' });
const PORT = process.env.PORT || 3000;

app.post('/compile', upload.single('plugin'), async (req, res) => {
  const zipPath = req.file?.path;
  if (!zipPath) return res.status(400).send('No file uploaded.');

  const buildId = Date.now();
  const workDir = `/tmp/plugin-${buildId}`;
  fs.mkdirSync(workDir);

  /* ---------- 1. UNZIP SAFELY ---------- */
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(workDir, true);
  } catch (zipErr) {
    console.error('❌ ZIP extraction failed:', zipErr);
    return res
      .status(400)
      .send(
        `Invalid ZIP archive. Make sure you’re sending a valid Maven project ` +
          `with pom.xml & src folders.\n\n${zipErr.message}`
      );
  }

  /* ---------- 2. RUN MAVEN ---------- */
  exec(
    'mvn -B -q clean package',
    { cwd: workDir, maxBuffer: 1024 * 500 },
    (err, _stdout, stderr) => {
      if (err) {
        console.error('❌ Maven failed:', stderr);
        return res.status(500).send(`Build failed:\n\n${stderr || err.message}`);
      }

      /* ---------- 3. FIND THE JAR ---------- */
      const targetDir = path.join(workDir, 'target');
      const jarName = fs
        .readdirSync(targetDir)
        .find((f) => f.endsWith('.jar'));

      if (!jarName) {
        return res
          .status(500)
          .send('Build succeeded but no JAR found in /target.');
      }

      res.download(path.join(targetDir, jarName), jarName);
    }
  );
});

app.listen(PORT, () =>
  console.log(`🟢  Plugin compiler listening on ${PORT}`)
);
