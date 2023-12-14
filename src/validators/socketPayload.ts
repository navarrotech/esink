import * as yup from "yup"

import {
    DEFAULT_SOURCE
} from '../env';

const shape = {
    data: yup
        .object()
        .typeError("body.data attribute must be an object")
        .required("body.data attribute is required"),
    type: yup
        .string()
        .max(64, "body.type attribute must be less than 64 characters")
        .typeError("body.type attribute must be a string")
        .required("body.type attribute is required"),
    source: yup
        .string()
        .typeError("body.source attribute must be a string")
        .default(DEFAULT_SOURCE),
    version: yup
        .number()
        .typeError("body.version attribute must be a number")
        .default(1),
    timestamp: yup
        .number()
        .typeError("body.timestamp attribute must be a number")
        .default(() => Date.now()),
}

export const validator = yup.object().shape(shape)
export const routeValidator = yup.object().shape({
    ...shape,
    userId: yup
        .string()
        .typeError("body.userId attribute must be a string")
        .required("body.userId attribute is required"),
    securityToken: yup
        .string()
        .typeError("body.securityToken attribute must be a string")
        .required("body.securityToken attribute is required"),
})