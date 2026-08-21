import "@fontsource/inter";
import { AppDialogProvider } from "../components/AppDialog";
import AppLayout from "../components/AppLayout";
import { APP_DESCRIPTION, APP_FULL_TITLE } from "../lib/brand";
import "./globals.css";

export const metadata = {
  title: APP_FULL_TITLE,
  description: APP_DESCRIPTION,
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="bg-sky-50 text-slate-900 antialiased" suppressHydrationWarning>
        <AppDialogProvider>
          <AppLayout>{children}</AppLayout>
        </AppDialogProvider>
      </body>
    </html>
  );
}
