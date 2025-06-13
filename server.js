import express from 'express';
import cors from 'cors';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { exec } from 'child_process';
import path from 'path';

const app = express();

// ----- Add CORS so your webapp can read the response -----
app.use(cors({
  origin: '*'        // or restrict to your frontend URL
}));

const upload = multer({ dest: '/tmp/uploads' });
const PORT = process.env.PORT || 3000;

app.post('/compile', upload.single('plugin'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const zipPath = req.file.path;
  const buildId = Date.now();
  const workDir = `/tmp/plugin-${buildId}`;
  fs.mkdirSync(workDir);

  // 1. Unzip
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(workDir, true);
  } catch (zipErr) {
    console.error('ZIP extraction failed:', zipErr);
    return res
      .status(400)
      .send(
        `Invalid ZIP archive. Ensure it's a Maven project with pom.xml.\n\n${zipErr.message}`
      );
  }

  // 2. Run Maven
  exec(
    'mvn -B -q clean package',
    { cwd: workDir, maxBuffer: 1024 * 500 },
    (err, _stdout, stderr) => {
      if (err) {
        console.error('Maven failed:', stderr);
        return res
          .status(500)
          .send(`Build failed:\n\n${stderr || err.message}`);
      }

      // 3. Send back the JAR
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
  console.log(`Plugin compiler listening on port ${PORT}`)
);
