/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as anaf_actions from "../anaf/actions.js";
import type * as app from "../app.js";
import type * as auth from "../auth.js";
import type * as contracts from "../contracts.js";
import type * as contracts_actions from "../contracts/actions.js";
import type * as dashboard from "../dashboard.js";
import type * as email_index from "../email/index.js";
import type * as email_sendOrgInvite from "../email/sendOrgInvite.js";
import type * as email_templates_orgInviteEmail from "../email/templates/orgInviteEmail.js";
import type * as email_templates_subscriptionEmail from "../email/templates/subscriptionEmail.js";
import type * as env from "../env.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as integrationApiKeys from "../integrationApiKeys.js";
import type * as integration_actions from "../integration/actions.js";
import type * as integration_authHelpers from "../integration/authHelpers.js";
import type * as integration_httpIntegration from "../integration/httpIntegration.js";
import type * as integration_shareableDraftValidate from "../integration/shareableDraftValidate.js";
import type * as lib_extractVariableNames from "../lib/extractVariableNames.js";
import type * as lib_ooxmlWText from "../lib/ooxmlWText.js";
import type * as organizations from "../organizations.js";
import type * as otp_ResendOTP from "../otp/ResendOTP.js";
import type * as otp_VerificationCodeEmail from "../otp/VerificationCodeEmail.js";
import type * as sign from "../sign.js";
import type * as sign_actions from "../sign/actions.js";
import type * as stripe from "../stripe.js";
import type * as templates from "../templates.js";
import type * as templates_actions from "../templates/actions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "anaf/actions": typeof anaf_actions;
  app: typeof app;
  auth: typeof auth;
  contracts: typeof contracts;
  "contracts/actions": typeof contracts_actions;
  dashboard: typeof dashboard;
  "email/index": typeof email_index;
  "email/sendOrgInvite": typeof email_sendOrgInvite;
  "email/templates/orgInviteEmail": typeof email_templates_orgInviteEmail;
  "email/templates/subscriptionEmail": typeof email_templates_subscriptionEmail;
  env: typeof env;
  http: typeof http;
  init: typeof init;
  integrationApiKeys: typeof integrationApiKeys;
  "integration/actions": typeof integration_actions;
  "integration/authHelpers": typeof integration_authHelpers;
  "integration/httpIntegration": typeof integration_httpIntegration;
  "integration/shareableDraftValidate": typeof integration_shareableDraftValidate;
  "lib/extractVariableNames": typeof lib_extractVariableNames;
  "lib/ooxmlWText": typeof lib_ooxmlWText;
  organizations: typeof organizations;
  "otp/ResendOTP": typeof otp_ResendOTP;
  "otp/VerificationCodeEmail": typeof otp_VerificationCodeEmail;
  sign: typeof sign;
  "sign/actions": typeof sign_actions;
  stripe: typeof stripe;
  templates: typeof templates;
  "templates/actions": typeof templates_actions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
