// https://cloud.google.com/datastore/docs/concepts/errors
// https://github.com/googleapis/googleapis/blob/master/google/rpc/code.proto

export enum errorCodes {
    INVALID_ARGUMENT = 3,
    DEADLINE_EXCEEDED = 4,
    NOT_FOUND = 5,
    ALREADY_EXISTS = 6,
    PERMISSION_DENIED = 7,
    RESOURCE_EXHAUSTED = 8,
    FAILED_PRECONDITION = 9,
    ABORTED = 10,
    INTERNAL = 13,
    UNAVAILABLE = 14,
    UNAUTHENTICATED = 16,
}
