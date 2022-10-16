export const errorMessage = {
    invalidID: (idName: string) => `${idName} must be a 24 character hex string`,
    cssIsNotAnObject: `Invalid CSS Object provided. Must provide valid serialized JSON`,
    undefinedTextField: `undefined Text Value. A value Must be provided`
}