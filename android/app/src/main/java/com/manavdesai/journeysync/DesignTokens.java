package com.manavdesai.journeysync;

/**
 * Generated from design/tokens.json. Do not edit by hand.
 * Run `npm run tokens` after changing that file.
 *
 * <p>Colours are kept as #RRGGBB strings because the screens are built in code
 * and pass them straight to {@link android.graphics.Color#parseColor}.
 */
final class DesignTokens {

    private DesignTokens() {
    }

    /** Darkest brand surface: sidebar, status banner, sign-in intro panel. */
    static final String NAVY = "#17212B"; // navy

    /** Primary text on light surfaces, and unselected map pins. */
    static final String INK = "#1B2731"; // ink

    /** Secondary text and captions. */
    static final String MUTED = "#72808A"; // muted

    /** Tertiary text, one step lighter than muted. */
    static final String FAINT = "#7B8990"; // faint

    /** App background behind cards. */
    static final String CREAM = "#F4F1EA"; // cream

    /** Card and sheet surface. Also the Android status bar backdrop. */
    static final String SURFACE = "#FFFDF8"; // paper

    /** Hairline borders and dividers. */
    static final String LINE = "#DEDBD2"; // line

    /** Brand accent, selected state, and the delayed-flight signal. */
    static final String CORAL = "#EF7159"; // coral

    /** Pressed state for coral buttons. Currently unused: coral moved to warnings and destructive actions only, and those surfaces have no pressed variant yet. */
    static final String CORAL_PRESSED = "#D85C45"; // coralPressed

    /** Soft positive fill. */
    static final String MINT = "#B9DDC7"; // mint

    /** Informational badges. */
    static final String BLUE = "#89B8D8"; // blue

    /** On-time and settled, on a light background. */
    static final String GREEN = "#1D7A48"; // success

    /** The same on-time signal placed on navy. A separate token on purpose: the two are not interchangeable, because each is chosen for contrast against its own background. */
    static final String GREEN_ON_DARK = "#73C994"; // successOnDark

    /** Caution state, short of an outright delay. */
    static final String ORANGE = "#D97706"; // warning

    /** Destructive actions: delete an expense, a wallet document, a traveler. */
    static final String DANGER = "#E53E3E"; // danger

    /** Secondary categorical accent. Renamed from --accent on the web when the interactive accent moved to blue; the Android name was already PURPLE. */
    static final String PURPLE = "#7C3AED"; // purple

    /** Pressed state for the interactive accent. */
    static final String BLUE_PRESSED = "#6F9FBE"; // accentPressed

    /** Tinted fill behind the interactive accent. */
    static final String BLUE_SOFT = "#E7F2F8"; // accentSoft

    /** Corner radius for cards and the embedded trip map. */
    static final int RADIUS_DP = 10; // card

}
