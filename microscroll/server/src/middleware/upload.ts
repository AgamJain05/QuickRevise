import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { errors } from '../utils/errors.js';

// Allowed file types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.txt'];

// Storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  },
});

// File filter
const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Check extension
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    cb(errors.badRequest(
      `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    ));
    return;
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(errors.badRequest('Invalid file type'));
    return;
  }

  cb(null, true);
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1,
  },
});

// Helper to get file type from extension
export function getFileType(filename: string): 'pdf' | 'docx' | 'pptx' | 'txt' {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.pptx':
      return 'pptx';
    case '.txt':
      return 'txt';
    default:
      return 'txt';
  }
}
