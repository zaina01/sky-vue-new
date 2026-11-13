import java.sql.*;

// Only for the disposable account-file plugin created by frontend-integration.mjs.
class RemoveDeletedAccountFileFixture {
    public static void main(String[] args) throws Exception {
        String installationId = args[0];
        String pluginId = args[1];
        if (!pluginId.matches("frontend-ui-account-file-[a-z0-9]+")) throw new IllegalArgumentException("Not an acceptance fixture");
        try (Connection connection = DriverManager.getConnection(
                "jdbc:mysql://localhost:3306/sky_new_frontend_it?useSSL=false&allowPublicKeyRetrieval=true", "root", "root")) {
            if (!"sky_new_frontend_it".equals(connection.getCatalog())) throw new IllegalStateException("Wrong test database");
            String predicate = "i.installation_id=? AND i.plugin_id=? AND i.deleted=TRUE AND i.installation_name LIKE 'Complex JSON acceptance %' AND d.display_name='Frontend Account File Acceptance'";
            try (PreparedStatement statement = connection.prepareStatement("SELECT i.installation_id FROM plugin_installation i JOIN plugin_definition d ON d.plugin_id=i.plugin_id WHERE " + predicate)) {
                statement.setString(1, installationId);
                statement.setString(2, pluginId);
                try (ResultSet result = statement.executeQuery()) {
                    if (!result.next() || result.next()) throw new IllegalStateException("Expected one own deleted fixture");
                }
            }
            try (PreparedStatement statement = connection.prepareStatement("DELETE i FROM plugin_installation i JOIN plugin_definition d ON d.plugin_id=i.plugin_id WHERE " + predicate)) {
                statement.setString(1, installationId);
                statement.setString(2, pluginId);
                if (statement.executeUpdate() != 1) throw new IllegalStateException("Fixture cleanup changed no row");
            }
        }
    }
}
