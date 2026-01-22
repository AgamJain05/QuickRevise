import { Request, Response, NextFunction } from 'express';
import {
  getSettings,
  updateSettings,
  deleteAllUserData,
  exportUserData,
} from '../services/settingsService.js';

// ===========================================
// Settings Controller
// ===========================================

/**
 * GET /api/settings
 * Get user settings
 */
export async function getUserSettings(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const settings = await getSettings(userId);
    
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/settings
 * Update user settings
 */
export async function patchSettings(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { theme, dailyGoal, soundEnabled, hapticsEnabled, autoPlayEnabled } = req.body;
    
    const settings = await updateSettings(userId, {
      theme,
      dailyGoal,
      soundEnabled,
      hapticsEnabled,
      autoPlayEnabled,
    });
    
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/settings/export
 * Export all user data
 */
export async function exportData(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const data = await exportUserData(userId);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="microscroll-export-${new Date().toISOString().split('T')[0]}.json"`
    );
    
    res.json(data);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/settings/data
 * Delete all user data (keep account)
 */
export async function deleteData(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    
    // Require confirmation in body
    const { confirm } = req.body;
    if (confirm !== 'DELETE_ALL_DATA') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required. Send { "confirm": "DELETE_ALL_DATA" }',
      });
    }
    
    await deleteAllUserData(userId);
    
    res.json({
      success: true,
      message: 'All user data has been deleted',
    });
  } catch (error) {
    next(error);
  }
}
