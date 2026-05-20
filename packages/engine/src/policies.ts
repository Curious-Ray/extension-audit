/**
 * Verbatim policy text from the official Chrome Web Store violations doc,
 * keyed by notification ID. Checkers reference these so every finding carries
 * the exact policy language a reviewer would cite.
 */
export interface Policy {
  notificationId: string;
  category: string;
  quote: string;
}

export const POLICIES = {
  BLUE_ARGON: {
    notificationId: 'Blue Argon',
    category: 'Remote code (MV3)',
    quote:
      'Extensions using Manifest V3 must meet additional requirements related to the extension’s code. Specifically, the full functionality of an extension must be easily discernible from its submitted code. This means that the logic of how each extension operates should be self-contained. The extension may reference and load data and other information sources that are external to the extension, but these external resources must not contain any logic.',
  },
  YELLOW_MAGNESIUM: {
    notificationId: 'Yellow Magnesium',
    category: 'Functionality not working / packaging',
    quote:
      'Functionality: Do not post an extension with a single purpose of installing or launching another app, theme, webpage, or extension. Extensions with broken functionality—such as dead sites or non-functioning features—are not allowed.',
  },
  PURPLE_POTASSIUM: {
    notificationId: 'Purple Potassium',
    category: 'Excessive permissions',
    quote:
      'Request access to the narrowest permissions necessary to implement your Product’s features or services. If more than one permission could be used to implement a feature, you must request those with the least access to data or functionality. Don’t attempt to “future proof” your Product by requesting a permission that might benefit services or features that have not yet been implemented.',
  },
  YELLOW_ZINC: {
    notificationId: 'Yellow Zinc',
    category: 'Missing or insufficient metadata',
    quote:
      'Impersonation or Deceptive Behavior: If your product has a blank description field or is missing an icon or screenshots, it will be rejected. If any of your product’s content, title, icon, description, or screenshots contains false or misleading information, we may remove it.',
  },
  RED_NICKEL: {
    notificationId: 'Red Nickel',
    category: 'Deceptive behavior',
    quote:
      'We do not allow products that deceive or mislead users, including in the content, title, description, or screenshots. Don’t misrepresent the functionality of your product or include non-obvious functionality that doesn’t serve the primary purpose of the product.',
  },
  PURPLE_LITHIUM: {
    notificationId: 'Purple Lithium',
    category: 'User data policy — privacy policy disclosure',
    quote:
      'If your Product handles personal or sensitive user data … then your Product must: Post a privacy policy, and Handle the user data securely, including transmitting it via modern cryptography.',
  },
  PURPLE_COPPER: {
    notificationId: 'Purple Copper',
    category: 'User data policy — secure transmission',
    quote:
      'Posting a Privacy Policy & Secure Transmission: … your Product must: Post a privacy policy, and Handle the user data securely, including transmitting it via modern cryptography.',
  },
  PURPLE_NICKEL: {
    notificationId: 'Purple Nickel',
    category: 'User data policy — prominent disclosure',
    quote:
      'Prominent Disclosure Requirement: If your Product handles personal or sensitive user data that is not closely related to functionality described prominently in the Product’s Chrome Web Store page and user interface, then prior to the collection, it must: Prominently disclose how the user data will be used, and Obtain the user’s affirmative consent for such use.',
  },
  RED_MAGNESIUM: {
    notificationId: 'Red Magnesium',
    category: 'Single purpose',
    quote:
      'Single Purpose: An extension must have a single purpose that is narrow and easy-to-understand. Do not create an extension that requires users to accept bundles of unrelated functionality. If two pieces of functionality are clearly separate, they should be put into two different extensions.',
  },
  YELLOW_ARGON: {
    notificationId: 'Yellow Argon',
    category: 'Keyword stuffing',
    quote:
      'Keyword Spam is the practice of including irrelevant or excessive keywords in an extensions description in an attempt to manipulate its ranking … Some examples of Keyword Spam include: Lists of sites/brands/keywords without substantial added value; Lists of regional locations; Unnatural repetition of the same keyword more than 5 times.',
  },
  RED_TITANIUM: {
    notificationId: 'Red Titanium',
    category: 'Obfuscation',
    quote:
      'Code Readability Requirements: Developers must not obfuscate code or conceal functionality of their extension. This also applies to any external code or resource fetched by the extension package. Minification is allowed …',
  },
  YELLOW_POTASSIUM: {
    notificationId: 'Yellow Potassium',
    category: 'Minimum functionality',
    quote:
      'Extensions must provide a basic degree of functionality and utility that provide value to the catalog of the Chrome Web Store. Some examples of common violations include: Extensions with no functionality or utility; Extensions with functionality that is not directly provided by the extension.',
  },
  BLUE_NICKEL: {
    notificationId: 'Blue Nickel',
    category: 'Circumvents the overrides API',
    quote:
      'API Use: Extensions must use existing Chrome APIs for their designated use case. Use of any other method, for which an API exists, would be considered a violation. For example, overriding the Chrome New Tab Page through any means other than the URL Overrides API is not permitted.',
  },
  YELLOW_NICKEL: {
    notificationId: 'Yellow Nickel',
    category: 'Spam',
    quote:
      'Notification Abuse / Message Spam / Repetitive Content: We don’t allow extensions that abuse notifications, send messages on behalf of the user without consent, or submit multiple extensions that provide duplicate experiences or functionality.',
  },
  YELLOW_LITHIUM: {
    notificationId: 'Yellow Lithium',
    category: 'Redirection',
    quote:
      'Functionality: Do not post an extension with a single purpose of installing or launching another app, theme, webpage, or extension.',
  },
  GREY_SILICON: {
    notificationId: 'Grey Silicon',
    category: 'Cryptocurrency mining',
    quote:
      'Prohibited Products: We don’t allow products or services that … Mine cryptocurrency.',
  },
  GREY_TITANIUM: {
    notificationId: 'Grey Titanium',
    category: 'Affiliate ads',
    quote:
      'Any affiliate program must be described prominently in the product’s Chrome Web Store page, user interface, and before installation. Related user action is required before the inclusion of each affiliate code, link, or cookie.',
  },
} as const satisfies Record<string, Policy>;

export type PolicyKey = keyof typeof POLICIES;
