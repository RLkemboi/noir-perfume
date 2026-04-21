type MpesaEnvironment = "sandbox" | "production";

export interface MpesaStkPayload {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDesc: string;
}

export interface MpesaStkResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
  responseDescription: string;
  mock: boolean;
}

function getEnvironment(): MpesaEnvironment {
  return process.env.MPESA_ENVIRONMENT === "production" ? "production" : "sandbox";
}

function getBaseUrl() {
  return getEnvironment() === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export function normalizeMpesaPhone(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  throw new Error("Enter a valid Safaricom phone number, for example 0712345678.");
}

function getTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function getConfig() {
  return {
    consumerKey: process.env.MPESA_CONSUMER_KEY || "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || "",
    shortcode: process.env.MPESA_SHORTCODE || process.env.MPESA_TILL_NUMBER || "",
    passkey: process.env.MPESA_PASSKEY || "",
    callbackUrl: process.env.MPESA_CALLBACK_URL || "",
    transactionType: process.env.MPESA_TRANSACTION_TYPE || "CustomerBuyGoodsOnline",
    mockEnabled: process.env.MPESA_MOCK_STK !== "false",
  };
}

function isConfigured() {
  const config = getConfig();
  return Boolean(
    config.consumerKey &&
      config.consumerSecret &&
      config.shortcode &&
      config.passkey &&
      config.callbackUrl
  );
}

async function getAccessToken() {
  const { consumerKey, consumerSecret } = getConfig();
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const response = await fetch(`${getBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  const data = (await response.json().catch(() => ({}))) as { access_token?: string; errorMessage?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.errorMessage || "Unable to authenticate with M-Pesa.");
  }

  return data.access_token;
}

export async function initiateMpesaStkPush(payload: MpesaStkPayload): Promise<MpesaStkResult> {
  const config = getConfig();
  const phoneNumber = normalizeMpesaPhone(payload.phoneNumber);

  if (!isConfigured()) {
    if (!config.mockEnabled) {
      throw new Error("M-Pesa is not configured. Set MPESA credentials and callback URL on the server.");
    }

    return {
      merchantRequestId: `mock-merchant-${Date.now()}`,
      checkoutRequestId: `mock-checkout-${Date.now()}`,
      customerMessage: "Mock STK push created. Add real M-Pesa credentials to go live.",
      responseDescription: "Mock STK request accepted",
      mock: true,
    };
  }

  const timestamp = getTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
  const accessToken = await getAccessToken();

  const response = await fetch(`${getBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: Math.round(payload.amount),
      PartyA: phoneNumber,
      PartyB: config.shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: config.callbackUrl,
      AccountReference: payload.accountReference,
      TransactionDesc: payload.transactionDesc,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    CustomerMessage?: string;
    ResponseDescription?: string;
    errorMessage?: string;
  };

  if (!response.ok || !data.CheckoutRequestID || !data.MerchantRequestID) {
    throw new Error(data.errorMessage || data.ResponseDescription || "M-Pesa STK push request failed.");
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    customerMessage: data.CustomerMessage || "STK push sent.",
    responseDescription: data.ResponseDescription || "Accepted",
    mock: false,
  };
}
