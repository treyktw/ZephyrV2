// internal/errors/errors.go
package errors

import (
	"context"
	"fmt"
	"runtime"
	"strings"
)

type ServiceError struct {
	Code    ErrorCode
	Message string
	Cause   error
	Stack   string
	Context map[string]interface{}
}

type ErrorCode int

const (
	ErrUnknown ErrorCode = iota
	ErrConfiguration
	ErrRedisConnection
	ErrSingleStoreConnection
	ErrVideoProcessing
	ErrFrameExtraction
	ErrVectorGeneration
	ErrMLModel
	ErrStorage
	ErrShutdown
)

func (e *ServiceError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%d] %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("[%d] %s", e.Code, e.Message)
}

// New creates a new ServiceError with stack trace
func New(code ErrorCode, message string) *ServiceError {
	return &ServiceError{
		Code:    code,
		Message: message,
		Stack:   getStack(),
		Context: make(map[string]interface{}),
	}
}

// Wrap wraps an existing error
func Wrap(err error, code ErrorCode, message string) *ServiceError {
	if err == nil {
		return nil
	}

	return &ServiceError{
		Code:    code,
		Message: message,
		Cause:   err,
		Stack:   getStack(),
		Context: make(map[string]interface{}),
	}
}

// WithContext adds context to the error
func (e *ServiceError) WithContext(key string, value interface{}) *ServiceError {
	e.Context[key] = value
	return e
}

func getStack() string {
	var buffer strings.Builder

	// Skip the first 2 frames (this function and the error creation)
	for i := 2; ; i++ {
		pc, file, line, ok := runtime.Caller(i)
		if !ok {
			break
		}
		fn := runtime.FuncForPC(pc)
		fmt.Fprintf(&buffer, "%s:%d %s\n", file, line, fn.Name())
	}

	return buffer.String()
}

// Error handling utilities
type ErrorHandler struct {
	errors chan error
	logger Logger
}

type Logger interface {
	Error(msg string, fields map[string]interface{})
	Info(msg string, fields map[string]interface{})
}

func NewErrorHandler(logger Logger) *ErrorHandler {
	return &ErrorHandler{
		errors: make(chan error, 100),
		logger: logger,
	}
}

// Handle processes errors asynchronously
func (h *ErrorHandler) Handle(err error) {
	if err == nil {
		return
	}

	select {
	case h.errors <- err:
		// Error queued successfully
	default:
		// Channel full, log immediately
		h.logError(err)
	}
}

func (h *ErrorHandler) logError(err error) {
	if svcErr, ok := err.(*ServiceError); ok {
		h.logger.Error(svcErr.Message, map[string]interface{}{
			"error_code": svcErr.Code,
			"cause":      svcErr.Cause,
			"stack":      svcErr.Stack,
			"context":    svcErr.Context,
		})
	} else {
		h.logger.Error(err.Error(), nil)
	}
}

// StartProcessing starts processing errors in the background
func (h *ErrorHandler) StartProcessing(ctx context.Context) {
	go func() {
		for {
			select {
			case err := <-h.errors:
				h.logError(err)
			case <-ctx.Done():
				return
			}
		}
	}()
}
