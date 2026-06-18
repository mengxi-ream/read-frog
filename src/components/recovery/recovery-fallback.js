import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { IconAlertCircle } from "@tabler/icons-react";
import { useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { toast } from "sonner";
import { i18n } from "#imports";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, } from "@/components/ui/base-ui/alert-dialog";
import { Button } from "@/components/ui/base-ui/button";
import { useExportConfig } from "@/hooks/use-export-config";
import { configAtom, writeConfigAtom } from "@/utils/atoms/config";
import { CONFIG_SCHEMA_VERSION, DEFAULT_CONFIG } from "@/utils/constants/config";
import { Alert, AlertDescription, AlertTitle } from "../ui/base-ui/alert";
export function RecoveryFallback({ error, onRecovered }) {
    const config = useAtomValue(configAtom);
    const setConfig = useSetAtom(writeConfigAtom);
    const [isResetting, setIsResetting] = useState(false);
    const { mutate: exportConfig, isPending: isExporting } = useExportConfig({
        config,
        schemaVersion: CONFIG_SCHEMA_VERSION,
    });
    const handleResetConfig = async () => {
        setIsResetting(true);
        try {
            await setConfig(DEFAULT_CONFIG);
            toast.success(i18n.t("errorRecovery.resetSuccess"));
            onRecovered();
        }
        catch {
            toast.error(i18n.t("errorRecovery.resetFailed"));
        }
        finally {
            setIsResetting(false);
        }
    };
    return (_jsx("div", { className: "w-full min-h-full p-4 md:p-6", children: _jsxs("div", { className: "mx-auto max-w-xl rounded-xl border bg-card p-4 md:p-6 space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-lg font-semibold", children: i18n.t("errorRecovery.title") }), _jsx("p", { className: "text-sm text-muted-foreground", children: i18n.t("errorRecovery.description") })] }), error?.message && (_jsxs(Alert, { variant: "destructive", children: [_jsx(IconAlertCircle, {}), _jsx(AlertTitle, { children: i18n.t("errorRecovery.errorDetails") }), _jsx(AlertDescription, { children: error.message })] })), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-sm font-medium", children: i18n.t("errorRecovery.backupTitle") }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "outline", onClick: () => exportConfig(true), disabled: isExporting || isResetting, children: i18n.t("errorRecovery.exportWithApiKeys") }), _jsx(Button, { variant: "outline", onClick: () => exportConfig(false), disabled: isExporting || isResetting, children: i18n.t("errorRecovery.exportWithoutApiKeys") })] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx("p", { className: "text-sm font-medium", children: i18n.t("errorRecovery.recoveryTitle") }), _jsx(Button, { onClick: () => window.location.reload(), children: i18n.t("errorRecovery.refreshPage") }), _jsxs(AlertDialog, { children: [_jsx(AlertDialogTrigger, { render: _jsx(Button, { variant: "destructive", disabled: isExporting || isResetting }), children: i18n.t("errorRecovery.resetAction") }), _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: i18n.t("errorRecovery.resetDialog.title") }), _jsx(AlertDialogDescription, { children: i18n.t("errorRecovery.resetDialog.description") })] }), _jsxs(AlertDialogFooter, { children: [_jsx(AlertDialogCancel, { children: i18n.t("errorRecovery.resetDialog.cancel") }), _jsx(AlertDialogAction, { variant: "destructive", onClick: handleResetConfig, disabled: isResetting, children: i18n.t("errorRecovery.resetDialog.confirm") })] })] })] })] })] }) }));
}
