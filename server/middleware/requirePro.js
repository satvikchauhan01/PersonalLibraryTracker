// Phase 09: gate for Pro-only features. Use *after* `protect`.
const requirePro = (req, res, next) => {
  if (!req.user.isPro) {
    return res.status(402).json({
      message: 'This feature requires Library Pro.',
      upgradeRequired: true,
    });
  }
  next();
};

export default requirePro;
