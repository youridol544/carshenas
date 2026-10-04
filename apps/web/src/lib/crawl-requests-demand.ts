// How far back the pasted links count as demand for a model on the superadmin's screen (CS-115): model_demand holds one
// row per Tehran day, model and kind, and the screen sums the last PASTE_DAYS days of kind paste. One number, so the query
// and the words beside the figure cannot disagree.

export const PASTE_DAYS = 30;
