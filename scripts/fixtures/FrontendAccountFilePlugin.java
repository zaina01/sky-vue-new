package com.sky.frontend.acceptance;

import com.sky.plugin.api.*;
import java.util.List;
import java.util.Map;

@SkyPlugin(pluginId = "__PLUGIN_ID__", version = "1.0.0", displayName = "Frontend Account File Acceptance",
    capabilities = {PluginCapability.TASK, PluginCapability.ACCOUNT}, accountClass = FrontendAccountFilePlugin.Account.class)
public class FrontendAccountFilePlugin implements TaskPlugin {
    public TaskResult run(TaskExecutionContext context) { return TaskResult.success(); }

    @PluginAccount("Account File Acceptance")
    public static class Account {
        @AccountId @AccountField(label = "Account ID", required = true)
        public String accountId;
        @AccountField(label = "List", type = AccountFieldType.LIST)
        public List<String> items;
        @AccountField(label = "Multiple choices", type = AccountFieldType.MULTI_SELECT, options = {"商品A", "商品B"})
        public List<String> choices;
        @AccountField(label = "Checkbox choices", type = AccountFieldType.CHECKBOX, options = {"商品A", "商品B"})
        public List<String> checks;
        @AccountField(label = "Map", type = AccountFieldType.MAP)
        public Map<String, String> properties;
        @AccountField(label = "Object list", type = AccountFieldType.OBJECT_LIST, itemClass = Item.class)
        public List<Item> profiles;
    }

    public static class Item {
        @AccountField(label = "Name")
        public String name;
    }
}
