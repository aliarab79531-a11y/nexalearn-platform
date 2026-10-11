const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  console.error("API Error:", err);

  const statusCode = err.status || (res.statusCode !== 200 ? res.statusCode : 500);
  const code = err.code || (statusCode === 404 ? "NOT_FOUND" : "REQUEST_FAILED");
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
    message,
  });
};

module.exports = errorHandler;