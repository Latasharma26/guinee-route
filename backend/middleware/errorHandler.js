const logError = (event, error) => {
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_]+$/i.test(error.code)
      ? error.code
      : "UNEXPECTED_ERROR";
  console.error(JSON.stringify({ event, code }));
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
  logError("request_failed", error);

  res.status(status).json({
    success: false,
    message: status < 500 ? "Invalid request" : "Internal server error",
  });
};

module.exports = { errorHandler, logError };